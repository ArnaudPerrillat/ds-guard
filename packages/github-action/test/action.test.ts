import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runAction } from '../src/action.js'

const fixture = path.resolve(__dirname, '../../../fixtures/vitals-app')

function prRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-action-'))
  fs.cpSync(fixture, dir, { recursive: true, filter: (p) => !p.includes('.ds-guard') })
  const git = (...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8' }).trim()
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'base')
  const base = git('rev-parse', 'HEAD')
  fs.appendFileSync(path.join(dir, 'src/pages/dashboard.scss'), '\n.new { margin: 24px; }\n')
  fs.writeFileSync(path.join(dir, 'src/pages/New.tsx'), 'export const N = () => <img src="/x.png" />\n')
  git('add', '.'); git('commit', '-qm', 'change')
  const eventPath = path.join(dir, '..', path.basename(dir) + '-event.json')
  fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 7, base: { sha: base } }, repository: { full_name: 'acme/vitals' } }))
  return { dir, eventPath }
}

function fakeGitHub(existing: { id: number; body: string }[]) {
  const calls: { url: string; method: string; body?: string }[] = []
  const fetchImpl = async (url: string, init: { method?: string; body?: string } = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body })
    return { ok: true, status: 200, json: async () => (init.method ? {} : existing), text: async () => '' }
  }
  return { calls, fetchImpl }
}

describe('github action', () => {
  it('comments findings on changed lines only, writes summary and outputs, fails on blocking a11y', async () => {
    const { dir, eventPath } = prRepo()
    const summary = path.join(dir, '..', path.basename(dir) + '-summary.md')
    const output = path.join(dir, '..', path.basename(dir) + '-output.txt')
    const gh = fakeGitHub([{ id: 1, body: 'unrelated' }])
    const logs: string[] = []
    const r = await runAction({ GITHUB_WORKSPACE: dir, GITHUB_EVENT_PATH: eventPath, GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: output, 'INPUT_GITHUB-TOKEN': 't' }, gh.fetchImpl, (s) => logs.push(s))

    expect(r.result.findings.map((f) => f.ruleId).sort()).toEqual(['a11y-img-alt', 'no-hardcoded-spacing'])
    expect(r.comment).toBe('created')
    expect(gh.calls.at(-1)).toMatchObject({ method: 'POST', url: 'https://api.github.com/repos/acme/vitals/issues/7/comments' })
    expect(JSON.parse(gh.calls.at(-1)!.body!).body).toContain('on lines changed in this PR')
    expect(fs.readFileSync(summary, 'utf8')).toContain('### DS Guard')
    expect(fs.readFileSync(output, 'utf8')).toContain('blocking=1')
    expect(logs.some((l) => l.startsWith('::error file=src/pages/New.tsx,line=1'))).toBe(true)
    expect(r.exitCode).toBe(1)
  })

  it('updates its previous comment and can be made fully non-blocking', async () => {
    const { dir, eventPath } = prRepo()
    const gh = fakeGitHub([{ id: 42, body: '<!-- ds-guard:pr-comment -->\nold' }])
    const r = await runAction({ GITHUB_WORKSPACE: dir, GITHUB_EVENT_PATH: eventPath, 'INPUT_GITHUB-TOKEN': 't', 'INPUT_FAIL-ON': 'never' }, gh.fetchImpl, () => {})
    expect(r.comment).toBe('updated')
    expect(gh.calls.at(-1)).toMatchObject({ method: 'PATCH', url: 'https://api.github.com/repos/acme/vitals/issues/comments/42' })
    expect(r.exitCode).toBe(0)
  })
})

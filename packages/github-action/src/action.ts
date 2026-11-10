import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { COMMENT_MARKER, renderMarkdown, run, type RunResult } from '@ds-guard/cli'

export type Env = Record<string, string | undefined>
type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>

const input = (env: Env, name: string, fallback = '') => env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`]?.trim() || fallback

interface PullRequestEvent { pull_request?: { number: number; base: { sha: string } }; repository?: { full_name: string } }

export interface ActionResult { result: RunResult; comment?: 'created' | 'updated' | 'skipped' | 'failed'; exitCode: number }

export async function runAction(env: Env, fetchImpl: Fetch, log: (s: string) => void = console.log): Promise<ActionResult> {
  const root = path.resolve(env.GITHUB_WORKSPACE ?? '.', input(env, 'working-directory', '.'))
  const event = (env.GITHUB_EVENT_PATH && fs.existsSync(env.GITHUB_EVENT_PATH) ? JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8')) : {}) as PullRequestEvent
  const pr = event.pull_request
  if (pr) ensureCommit(root, pr.base.sha, log)

  const result = run({ root, base: pr?.base.sha })
  const scope = pr ? 'on lines changed in this PR' : undefined
  const body = renderMarkdown(result.summary, { findings: result.findings, excepted: result.excepted, scope })

  // Job summary and inline annotations: always, no token needed.
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, body)
  const rel = path.relative(env.GITHUB_WORKSPACE ?? root, root).split(path.sep).join('/')
  for (const f of result.findings.slice(0, 50)) {
    const level = result.blocking.includes(f) ? 'error' : f.severity === 'info' ? 'notice' : 'warning'
    log(`::${level} file=${rel ? rel + '/' : ''}${f.loc.file},line=${f.loc.line},col=${f.loc.column},title=DS Guard ${f.ruleId}::${f.message.replace(/\r?\n/g, ' ')}`)
  }

  let comment: ActionResult['comment'] = 'skipped'
  const token = input(env, 'github-token')
  const repo = event.repository?.full_name ?? env.GITHUB_REPOSITORY
  if (pr && repo && token && input(env, 'comment', 'true') !== 'false') {
    try {
      comment = await upsertComment(fetchImpl, env.GITHUB_API_URL ?? 'https://api.github.com', repo, pr.number, token, body)
    } catch (e) {
      comment = 'failed'
      // Typical on fork PRs, where the token is read-only: the job summary still has everything.
      log(`::warning title=DS Guard::Could not post the PR comment (${(e as Error).message}). Findings are in the job summary.`)
    }
  }

  const m = result.summary.metrics
  const outputs = { 'explained-coverage': m.explainedCoverage === null ? '' : String(Math.round(m.explainedCoverage * 100)), conformance: m.conformance === null ? '' : String(Math.round(m.conformance * 100)), findings: String(result.findings.length), blocking: String(result.blocking.length) }
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join(''))

  const failOn = input(env, 'fail-on', 'blocking')
  // Outside a PR the whole codebase is in scope: report existing debt, never fail on it.
  const exitCode = pr && failOn !== 'never' && result.blocking.length ? 1 : 0
  if (exitCode) log(`::error title=DS Guard::${result.blocking.length} blocking finding(s) on changed lines.`)
  return { result, comment, exitCode }
}

/** The base commit must be present for `git diff base...HEAD` (shallow checkouts). */
function ensureCommit(root: string, sha: string, log: (s: string) => void) {
  try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: root, stdio: 'ignore' }); return } catch { /* fetch below */ }
  try {
    execFileSync('git', ['fetch', '--no-tags', '--depth=200', 'origin', sha], { cwd: root, stdio: 'ignore' })
    execFileSync('git', ['fetch', '--no-tags', '--deepen=200', 'origin'], { cwd: root, stdio: 'ignore' })
  } catch { log('::warning title=DS Guard::Could not fetch the PR base commit; use actions/checkout with fetch-depth: 0.') }
}

export async function upsertComment(fetchImpl: Fetch, api: string, repo: string, issue: number, token: string, body: string): Promise<'created' | 'updated'> {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'ds-guard-action' }
  let existing: { id: number } | undefined
  for (let page = 1; page <= 10 && !existing; page++) {
    const res = await fetchImpl(`${api}/repos/${repo}/issues/${issue}/comments?per_page=100&page=${page}`, { headers })
    if (!res.ok) throw new Error(`listing comments: HTTP ${res.status}`)
    const list = (await res.json()) as { id: number; body?: string }[]
    existing = list.find((c) => c.body?.startsWith(COMMENT_MARKER))
    if (list.length < 100) break
  }
  const res = existing
    ? await fetchImpl(`${api}/repos/${repo}/issues/comments/${existing.id}`, { method: 'PATCH', headers, body: JSON.stringify({ body }) })
    : await fetchImpl(`${api}/repos/${repo}/issues/${issue}/comments`, { method: 'POST', headers, body: JSON.stringify({ body }) })
  if (!res.ok) throw new Error(`${existing ? 'updating' : 'creating'} comment: HTTP ${res.status}`)
  return existing ? 'updated' : 'created'
}

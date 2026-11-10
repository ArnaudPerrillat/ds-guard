import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { run } from '../src/api.js'

const fixture = path.resolve(__dirname, '../../../fixtures/vitals-app')
const cli = path.resolve(__dirname, '../dist/cli.js')
const now = new Date('2026-11-09')
const copy = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-cli-'))
  fs.cpSync(fixture, dir, { recursive: true, filter: (p) => !p.includes('.ds-guard') })
  return dir
}

describe('ds-guard on the fixture app', () => {
  it('scans: findings, exceptions, blocking a11y, metrics', () => {
    const r = run({ root: copy(), now })
    const by: Record<string, number> = {}
    for (const f of r.findings) by[f.ruleId] = (by[f.ruleId] ?? 0) + 1
    expect(by).toEqual({
      'a11y-img-alt': 1, 'a11y-no-positive-tabindex': 1, 'no-hardcoded-color': 2, 'no-hardcoded-spacing': 3, 'no-hardcoded-radius': 1,
      'no-hardcoded-font-size': 1, 'no-deprecated-component': 1, 'no-deprecated-prop': 1, 'no-invalid-prop-value': 1, 'prefer-ds-component': 3,
    })
    expect(r.excepted.map((f) => f.exception!.id).sort()).toEqual(['EXC-001', 'EXC-002', 'EXC-002'])
    expect(r.blocking).toHaveLength(2)
    expect(r.summary.metrics.wrappers.map((w) => w.wrapper).sort()).toEqual(['src/components/AppointmentCard.tsx#AppointmentCard', 'src/components/PrimaryAction.tsx#PrimaryAction'])
    expect(r.summary.metrics.explainedCoverage).toBeGreaterThan(0.6)
    expect(r.summary.exceptions.expiringSoon.map((e) => e.id)).toEqual(['EXC-002'])
  })

  it('PR mode only reports findings on changed lines', () => {
    const dir = copy()
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' })
    git('init', '-q'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base')
    fs.appendFileSync(path.join(dir, 'src/pages/dashboard.scss'), '\n.new { margin: 24px; }\n')
    git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'change')
    const r = run({ root: dir, base: 'HEAD~1', now })
    expect(r.findings.map((f) => `${f.ruleId}:${f.subject}`)).toEqual(['no-hardcoded-spacing:24px'])
    expect(r.blocking).toEqual([])
  })
})

describe('ds-guard on the Tailwind v4 fixture app', () => {
  it('reads the DS @theme, checks arbitrary values, class helpers, @apply and off-theme utilities', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-tw-'))
    fs.cpSync(path.resolve(__dirname, '../../../fixtures/pulse-app'), dir, { recursive: true, filter: (p) => !p.includes('.ds-guard') })
    const r = run({ root: dir, now })
    expect(r.findings.map((f) => `${f.loc.file}:${f.loc.line} ${f.ruleId} ${f.subject} -> ${f.fix?.replacement ?? ''}`)).toEqual([
      'src/app.css:10 no-hardcoded-spacing p-[13px] -> ',
      'src/app.css:10 no-hardcoded-color bg-[#ffffff] -> bg-surface',
      'src/components/StatusBadge.tsx:3 no-hardcoded-spacing py-[2px] -> py-0.5',
      'src/components/StatusBadge.tsx:3 no-hardcoded-radius rounded-[6px] -> rounded-control',
      'src/components/StatusBadge.tsx:7 no-hardcoded-color bg-[#c62828] -> bg-danger',
      'src/components/StatusBadge.tsx:7 no-off-theme-utility text-white -> ',
      'src/pages/Overview.tsx:7 no-hardcoded-spacing gap-[12px] -> gap-3',
      'src/pages/Overview.tsx:8 no-hardcoded-font-size text-[1.25rem] -> text-title',
      'src/pages/Overview.tsx:9 no-off-theme-utility rounded-lg -> ',
      'src/pages/Overview.tsx:12 no-off-theme-utility bg-blue-500 -> ',
      'src/pages/Overview.tsx:15 no-hardcoded-spacing mt-[13px] -> ',
    ])
    expect(r.excepted.map((f) => f.exception!.id)).toEqual(['EXC-001'])
    expect(r.summary.metrics.definition).toBe('1.1')
    expect(r.summary.metrics.styles.ds).toBeGreaterThan(5)
  })
})

describe('cli', () => {
  beforeAll(() => { if (!fs.existsSync(cli)) throw new Error('Build first: pnpm build') })
  const exec = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' })

  it('init detects the DS and tokens, then scan exits 1 on blocking findings only', () => {
    const dir = copy()
    fs.rmSync(path.join(dir, 'ds-guard.config.json'))
    const init = exec(['init', '--root', dir])
    expect(init.stdout).toContain('Design system: @vitals/ui')
    expect(init.stdout).toContain('@vitals/tokens/tokens.json')
    expect(exec(['scan', '--root', dir]).status).toBe(1)
    expect(exec(['scan', '--root', dir, '--fail-on', 'never']).status).toBe(0)
    const md = exec(['scan', '--root', dir, '--format', 'markdown'])
    expect(md.stdout).toContain('<!-- ds-guard:pr-comment -->')
  })

  it('report writes both pages and records history', () => {
    const dir = copy()
    const out = path.join(dir, 'out')
    expect(exec(['report', '--root', dir, '--out', out, '--record']).status).toBe(0)
    expect(fs.readFileSync(path.join(out, 'leadership.html'), 'utf8')).toContain('Explained coverage')
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'ds-guard-history.json'), 'utf8'))).toHaveLength(1)
  })

  it('explains usage errors with exit code 2', () => {
    const r = exec(['scan', '--root', os.tmpdir()])
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('npx ds-guard init')
  })
})

describe('ds-guard exceptions', () => {
  it('lists, adds, renews and closes, editing ds-exceptions.yml in place', () => {
    const dir = copy()
    const exec = (...args: string[]) => spawnSync(process.execPath, [cli, 'exceptions', ...args, '--root', dir], { encoding: 'utf8' })
    const list = () => JSON.parse(exec('--format', 'json', '--within', '400').stdout) as { items: { id: string; covered: number }[] }
    expect(list().items.map((i) => [i.id, i.covered])).toEqual([['EXC-002', 2], ['EXC-001', 1]])
    expect(exec('add', '--rule', 'no-hardcoded-radius', '--reason', 'Campaign banner.', '--owner', '@jdoe', '--until', '2099-01-31').stdout).toContain('Added EXC-003')
    expect(exec('renew', 'EXC-002', '--until', '2099-06-30').status).toBe(0)
    expect(exec('close', 'EXC-001').stdout).toContain('src/pages/dashboard.scss')
    expect(list().items.map((i) => i.id)).toEqual(['EXC-003', 'EXC-002'])
    expect(fs.readFileSync(path.join(dir, 'ds-exceptions.yml'), 'utf8')).toContain('files: ["src/legacy/**"]')
    const bad = exec('add', '--rule', 'nope', '--reason', 'x', '--owner', '@a', '--until', '2099-01-01')
    expect([bad.status, bad.stderr.trim()]).toEqual([2, 'ds-guard: Unknown rule nope.'])
  })
})

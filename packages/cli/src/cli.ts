#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { ContractError } from '@ds-guard/contract'
import { renderHtmlReport, renderLeadership, renderMarkdown, renderText } from '@ds-guard/core'
import { exceptionsCommand } from './exceptions.js'
import { readHistory, recordSnapshot, run } from './api.js'
import { init } from './init.js'
import { loadConfig, loadContract, UsageError } from './project.js'

const HELP = `ds-guard: design-system compliance for React + TypeScript (local, offline)

Usage
  ds-guard init [--ds <package>]... [--tokens <module/path>]... [--force]
  ds-guard scan [--base <git-ref>] [--format text|markdown|json] [--output <file>] [--all] [--fail-on blocking|never]
  ds-guard report [--out <dir>] [--record]
  ds-guard contract
  ds-guard exceptions [--within <days>] [--format text|json|issue]
  ds-guard exceptions add --rule <id>... --reason <text> --owner <@who> --until <YYYY-MM-DD> [--id <ID>] [--files <glob>]... [--link <url>]
  ds-guard exceptions renew <id> --until <YYYY-MM-DD>
  ds-guard exceptions close <id>

Commands
  init      Detect the design system, write ds-guard.config.json and ds-exceptions.yml.
  scan      Check the code against the DS contract at the version in the lockfile.
            --base limits findings to lines changed since that ref (pull requests).
            Exit code 1 only for blocking findings (accessibility by default).
  report    Write the detailed report and the one-page leadership report (HTML).
            --record appends today's numbers to ds-guard-history.json for the trend.
  exceptions  List exceptions by expiry (expired, expiring within --within days, default 30),
            with covered findings and groups of similar exceptions. add, renew and close edit
            ds-exceptions.yml in place (comments kept): commit the change in a PR the DS team approves.
            --format issue prints the body of the weekly "Exceptions to review" issue.
  contract  Extract the contract only, to .ds-guard/contract.json (used by the ESLint plugin).

Options
  --root <dir>   Project root (default: current directory).
`

function main(argv: string[]): number {
  const { values, positionals } = parseArgs({
    args: argv, allowPositionals: true,
    options: {
      root: { type: 'string' }, ds: { type: 'string', multiple: true }, tokens: { type: 'string', multiple: true }, force: { type: 'boolean' },
      base: { type: 'string' }, format: { type: 'string' }, output: { type: 'string' }, all: { type: 'boolean' }, 'fail-on': { type: 'string' },
      out: { type: 'string' }, record: { type: 'boolean' },
      within: { type: 'string' }, rule: { type: 'string', multiple: true }, reason: { type: 'string' }, owner: { type: 'string' }, until: { type: 'string' },
      id: { type: 'string' }, files: { type: 'string', multiple: true }, link: { type: 'string' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    },
  })
  const cmd = positionals[0]
  if (values.version) { console.log('0.1.0'); return 0 }
  if (values.help || !cmd) { console.log(HELP); return cmd || values.help ? 0 : 2 }
  const root = path.resolve(values.root ?? '.')

  if (cmd === 'init') {
    for (const l of init(root, { ds: values.ds, tokens: values.tokens, force: values.force })) console.log(l)
    const { contract, notes } = loadContract(root, loadConfig(root))
    for (const n of notes) console.log('Note: ' + n)
    for (const p of contract.packages) console.log(`Contract: ${p.name}@${p.version} · ${Object.keys(p.components).length} components · ${p.tokens.length} tokens`)
    console.log('\nNext: npx ds-guard scan')
    return 0
  }

  if (cmd === 'contract') {
    const { contract, notes } = loadContract(root, loadConfig(root))
    for (const n of notes) console.error('Note: ' + n)
    for (const p of contract.packages) console.log(`${p.name}@${p.version} · ${Object.keys(p.components).length} components · ${p.tokens.length} tokens → .ds-guard/contract.json`)
    return 0
  }

  if (cmd === 'scan') {
    const r = run({ root, base: values.base })
    const format = values.format ?? 'text'
    const scope = values.base ? `on lines changed since ${values.base}` : undefined
    const out = format === 'json' ? JSON.stringify({ metrics: r.summary.metrics, versions: r.summary.versions, findings: r.findings, excepted: r.excepted, blocking: r.blocking, exceptions: r.summary.exceptions }, null, 2) + '\n'
      : format === 'markdown' ? renderMarkdown(r.summary, { findings: r.findings, excepted: r.excepted, scope })
      : format === 'text' ? renderText(r.summary, { findings: r.findings, maxPerRule: values.all ? Infinity : 10 })
      : null
    if (out === null) throw new UsageError(`Unknown --format ${format} (text, markdown, json).`)
    if (values.output) fs.writeFileSync(path.resolve(values.output), out)
    else process.stdout.write(out)
    for (const n of r.notes) console.error('Note: ' + n)
    if (format === 'text' && !values.output) console.error(`Scanned ${r.files} files in ${(r.ms / 1000).toFixed(1)} s.`)
    const failOn = values['fail-on'] ?? 'blocking'
    if (!['blocking', 'never'].includes(failOn)) throw new UsageError('--fail-on must be blocking or never.')
    return failOn === 'blocking' && r.blocking.length ? 1 : 0
  }

  if (cmd === 'report') {
    const r = run({ root })
    const dir = path.resolve(values.out ?? 'ds-guard-report')
    const project = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { name?: string }).name ?? path.basename(root)
    const history = values.record ? recordSnapshot(root, r.summary) : readHistory(root)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'index.html'), renderHtmlReport(r.summary, { project }))
    fs.writeFileSync(path.join(dir, 'leadership.html'), renderLeadership(r.summary, { project, history }))
    console.log(`Wrote ${path.relative(process.cwd(), path.join(dir, 'index.html'))} and leadership.html${values.record ? ' · recorded snapshot in ds-guard-history.json' : ''}`)
    return 0
  }

  if (cmd === 'exceptions') return exceptionsCommand(root, positionals.slice(1), values)

  throw new UsageError(`Unknown command "${cmd}". Run ds-guard --help.`)
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (e) {
  if (e instanceof UsageError || e instanceof ContractError || (e as { code?: string }).code?.startsWith('ERR_PARSE_ARGS')) {
    console.error('ds-guard: ' + (e as Error).message)
    process.exitCode = 2
  } else throw e
}

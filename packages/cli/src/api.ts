import fs from 'node:fs'
import path from 'node:path'
import { scan, summarize, toSnapshot, type Finding, type Snapshot, type Summary } from '@ds-guard/core'
import { changedLines, collectFiles, loadConfig, loadContract, loadExceptions, tsconfigAliases, type ProjectConfig } from './project.js'

export { UsageError, CONFIG_FILE, type ProjectConfig } from './project.js'
export { renderMarkdown, renderText, renderHtmlReport, renderLeadership, COMMENT_MARKER } from '@ds-guard/core'

export interface RunOptions {
  root: string
  /** Git ref: only findings on lines changed since its merge-base are reported (PR mode). */
  base?: string
  now?: Date
}

export interface RunResult {
  summary: Summary
  config: ProjectConfig
  notes: string[]
  /** Open findings in scope (all of them, or those on changed lines with `base`). */
  findings: Finding[]
  /** Excepted findings in scope. */
  excepted: Finding[]
  /** Blocking findings in scope. */
  blocking: Finding[]
  files: number
  ms: number
}

export function run(opts: RunOptions): RunResult {
  const t0 = performance.now()
  const root = path.resolve(opts.root)
  const now = opts.now ?? new Date()
  const config = loadConfig(root)
  const { contract, notes } = loadContract(root, config)
  const files = collectFiles(root, config)
  const result = scan({ files, contract, config, exceptions: loadExceptions(root), now, options: { aliases: config.aliases ?? tsconfigAliases(root) } })
  const summary = summarize(result, contract, config, now)
  let inScope = (_f: Finding) => true
  if (opts.base) {
    const changed = changedLines(root, opts.base)
    // Registry findings (expired, invalid…) stay visible: they are about the project, not a line.
    inScope = (f) => f.ruleId.startsWith('exception-') ? f.loc.file === 'ds-exceptions.yml' || !!changed.get(f.loc.file)?.has(f.loc.line) : !!changed.get(f.loc.file)?.has(f.loc.line)
  }
  return {
    summary, config, notes, files: files.length,
    findings: summary.open.filter(inScope),
    excepted: summary.excepted.filter(inScope),
    blocking: summary.blocking.filter(inScope),
    ms: Math.round(performance.now() - t0),
  }
}

export const HISTORY_FILE = 'ds-guard-history.json'

/** Appends today's snapshot (one per day) to the committed history used by the leadership trend. */
export function recordSnapshot(root: string, summary: Summary): Snapshot[] {
  const file = path.join(root, HISTORY_FILE)
  const history = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot[]) : []
  const snap = toSnapshot(summary)
  const next = [...history.filter((h) => h.date !== snap.date), snap].sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n')
  return next
}

export function readHistory(root: string): Snapshot[] {
  const file = path.join(root, HISTORY_FILE)
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot[]) : []
}

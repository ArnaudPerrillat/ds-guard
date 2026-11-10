// Intentional exceptions (ADR 0003): a declared deviation with an owner and an expiry date.
// Declared in ds-exceptions.yml, referenced in code with `// ds-exception: ID`
// (covers the comment's line and the next one) or scoped to files with `files:` globs.

import YAML from 'yaml'
import type { UiDocument } from './model.js'
import type { RuleMeta } from './rules.js'
import type { Finding } from './types.js'

export interface ExceptionEntry {
  id: string
  rules: string[]
  reason: string
  owner: string
  /** ISO date (YYYY-MM-DD), inclusive. */
  expires: string
  files?: string[]
  link?: string
}

export interface ExceptionRegistry {
  path: string
  entries: ExceptionEntry[]
  /** Validation problems, reported as `exception-invalid` findings. */
  problems: { message: string; line: number }[]
}

export const EXCEPTION_RULES: RuleMeta[] = [
  { id: 'exception-expired', severity: 'warning', category: 'exceptions', description: 'An exception past its expiry date: the findings it covered count again.' },
  { id: 'exception-unknown', severity: 'warning', category: 'exceptions', description: 'An annotation references an id that is not in ds-exceptions.yml.' },
  { id: 'exception-invalid', severity: 'warning', category: 'exceptions', description: 'An entry of ds-exceptions.yml is incomplete or malformed.' },
  { id: 'exception-unused', severity: 'info', category: 'exceptions', description: 'An annotation that covers no finding: the deviation is gone, remove the annotation.' },
]

export const EXCEPTIONS_FILE = 'ds-exceptions.yml'

export function parseExceptions(text: string, path = EXCEPTIONS_FILE, knownRules?: Set<string>): ExceptionRegistry {
  const problems: ExceptionRegistry['problems'] = []
  const entries: ExceptionEntry[] = []
  const lc = new YAML.LineCounter()
  let doc: YAML.Document.Parsed
  try {
    doc = YAML.parseDocument(text, { lineCounter: lc })
    if (doc.errors.length) throw doc.errors[0]
  } catch (e) {
    return { path, entries, problems: [{ message: `Invalid YAML: ${e instanceof Error ? e.message : String(e)}`, line: 1 }] }
  }
  const lineOf = (node: unknown) => {
    const range = (node as { range?: [number, number] } | undefined)?.range
    return range ? lc.linePos(range[0]).line : 1
  }
  const list = doc.get('exceptions', true)
  if (!YAML.isSeq(list)) return { path, entries, problems: text.trim() ? [{ message: 'Expected a top-level `exceptions:` list.', line: 1 }] : [] }
  const seen = new Set<string>()
  for (const node of list.items) {
    const line = lineOf(node)
    const raw = (YAML.isMap(node) ? node.toJSON() : null) as Record<string, unknown> | null
    if (!raw) { problems.push({ message: 'Each exception must be a mapping.', line }); continue }
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id) : ''
    const rules = Array.isArray(raw.rules) ? raw.rules.map(String) : typeof raw.rule === 'string' ? [raw.rule] : []
    const expires = raw.expires instanceof Date ? raw.expires.toISOString().slice(0, 10) : typeof raw.expires === 'string' ? raw.expires : ''
    const missing = [!id && 'id', !rules.length && 'rules', !raw.reason && 'reason', !raw.owner && 'owner', !expires && 'expires'].filter(Boolean)
    if (missing.length) { problems.push({ message: `Exception ${id || '(no id)'} is missing: ${missing.join(', ')}.`, line }); continue }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) { problems.push({ message: `Exception ${id}: \`expires\` must be a date (YYYY-MM-DD).`, line }); continue }
    if (seen.has(id)) { problems.push({ message: `Duplicate exception id ${id}.`, line }); continue }
    const unknown = knownRules ? rules.filter((r) => !knownRules.has(r)) : []
    if (unknown.length) problems.push({ message: `Exception ${id}: unknown rule ${unknown.join(', ')}.`, line })
    seen.add(id)
    const entry: ExceptionEntry = { id, rules, reason: String(raw.reason), owner: String(raw.owner), expires }
    if (Array.isArray(raw.files)) entry.files = raw.files.map(String)
    if (typeof raw.link === 'string') entry.link = raw.link
    entries.push(entry)
  }
  return { path, entries, problems }
}

export function isExpired(e: ExceptionEntry, now: Date): boolean {
  return e.expires < now.toISOString().slice(0, 10)
}

export function globToRegExp(glob: string): RegExp {
  let re = ''
  let braces = 0
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*' && glob[i + 1] === '*') { re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*'; i += glob[i + 2] === '/' ? 2 : 1 }
    else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '{') { re += '(?:'; braces++ }
    else if (c === '}' && braces) { re += ')'; braces-- }
    else if (c === ',' && braces) re += '|'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + re + '$')
}

/**
 * Marks findings covered by a live exception, re-opens findings whose exception expired,
 * and adds the registry's own findings (expired, unknown, invalid, unused).
 */
export function applyExceptions(findings: Finding[], docs: UiDocument[], registry: ExceptionRegistry | undefined, now: Date, severityOf: (id: string) => Finding['severity'] | 'off'): Finding[] {
  const byId = new Map((registry?.entries ?? []).map((e) => [e.id, e]))
  const fileRules = (registry?.entries ?? []).filter((e) => e.files?.length).map((e) => ({ e, res: e.files!.map(globToRegExp) }))
  const annotations = new Map(docs.map((d) => [d.path, d.annotations]))
  const meta: Finding[] = []
  const add = (ruleId: string, f: Omit<Finding, 'ruleId' | 'severity'>) => {
    const severity = severityOf(ruleId)
    if (severity !== 'off') meta.push({ ruleId, severity, ...f })
  }
  const usedAnnotations = new Set<string>()
  const expiredReported = new Set<string>()

  for (const f of findings) {
    const candidates: { e: ExceptionEntry; at: { file: string; line: number } }[] = []
    for (const a of annotations.get(f.loc.file) ?? []) {
      if (a.line !== f.loc.line && a.line !== f.loc.line - 1) continue
      const e = byId.get(a.exceptionId)
      if (e && e.rules.includes(f.ruleId)) { candidates.push({ e, at: { file: f.loc.file, line: a.line } }); usedAnnotations.add(`${f.loc.file}:${a.line}:${a.exceptionId}`) }
    }
    for (const { e, res } of fileRules) if (e.rules.includes(f.ruleId) && res.some((r) => r.test(f.loc.file))) candidates.push({ e, at: { file: registry!.path, line: 1 } })
    const live = candidates.find((c) => !isExpired(c.e, now))
    if (live) { f.exception = { id: live.e.id, owner: live.e.owner, expires: live.e.expires }; continue }
    for (const c of candidates) {
      const key = `${c.e.id}@${c.at.file}:${c.at.line}`
      if (expiredReported.has(key)) continue
      expiredReported.add(key)
      add('exception-expired', { loc: { ...c.at, column: 1 }, subject: c.e.id, message: `Exception ${c.e.id} (owner ${c.e.owner}) expired on ${c.e.expires}: renew it with a new date or fix the code.` })
    }
  }

  for (const d of docs) for (const a of d.annotations) {
    const loc = { file: d.path, line: a.line, column: 1 }
    if (!byId.has(a.exceptionId)) add('exception-unknown', { loc, subject: a.exceptionId, message: `\`ds-exception: ${a.exceptionId}\` is not declared in ${registry?.path ?? EXCEPTIONS_FILE}.` })
    else if (byId.get(a.exceptionId)!.rules.every((r) => severityOf(r) !== 'off') && !usedAnnotations.has(`${d.path}:${a.line}:${a.exceptionId}`)) add('exception-unused', { loc, subject: a.exceptionId, message: `\`ds-exception: ${a.exceptionId}\` covers no finding on this line or the next: remove it.` })
  }
  for (const p of registry?.problems ?? []) add('exception-invalid', { loc: { file: registry!.path, line: p.line, column: 1 }, subject: registry!.path, message: p.message })

  return [...findings, ...meta]
}

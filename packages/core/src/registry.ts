// Steering the exception registry (ADR 0017): status of each exception, groups of similar
// exceptions, comment-preserving edits of ds-exceptions.yml and the weekly review issue.
// Pure functions on text and data: file IO stays in the CLI.

import YAML from 'yaml'
import type { ExceptionEntry } from './exceptions.js'
import type { Finding } from './types.js'

export type ExceptionState = 'active' | 'expiring' | 'expired'

export interface ExceptionStatus extends ExceptionEntry {
  state: ExceptionState
  /** Days until the expiry date (0 = expires today, still valid; negative = expired). */
  daysLeft: number
  /** Findings this exception covers today (0 once expired). */
  covered: number
}

/** Several exceptions for the same rule: often the sign of a missing DS component or token. */
export interface SimilarityGroup {
  rule: string
  exceptions: string[]
  owners: string[]
  covered: number
  /** Most frequent subjects of the covered findings (e.g. `<table>`, `185px`). */
  subjects: { subject: string; count: number }[]
}

export interface ExceptionsOverview {
  date: string
  withinDays: number
  /** Sorted by expiry date, soonest first. */
  items: ExceptionStatus[]
  groups: SimilarityGroup[]
  counts: { active: number; expiring: number; expired: number }
}

const DAY = 86_400_000
const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s)

export function daysUntil(date: string, now: Date): number {
  return Math.round((Date.parse(date) - Date.parse(isoDay(now))) / DAY)
}

export function exceptionsOverview(entries: ExceptionEntry[], excepted: Finding[], now: Date, withinDays = 30): ExceptionsOverview {
  const covered = new Map<string, number>()
  for (const f of excepted) if (f.exception) covered.set(f.exception.id, (covered.get(f.exception.id) ?? 0) + 1)
  const items: ExceptionStatus[] = entries.map((e) => {
    const daysLeft = daysUntil(e.expires, now)
    const state: ExceptionState = daysLeft < 0 ? 'expired' : daysLeft <= withinDays ? 'expiring' : 'active'
    return { ...e, state, daysLeft, covered: covered.get(e.id) ?? 0 }
  }).sort((a, b) => a.expires.localeCompare(b.expires) || a.id.localeCompare(b.id))

  const byRule = new Map<string, ExceptionStatus[]>()
  for (const it of items) for (const r of it.rules) (byRule.get(r) ?? byRule.set(r, []).get(r)!).push(it)
  const groups: SimilarityGroup[] = []
  for (const [rule, its] of byRule) {
    if (its.length < 2) continue
    const ids = new Set(its.map((i) => i.id))
    const subjects = new Map<string, number>()
    let n = 0
    for (const f of excepted) if (f.ruleId === rule && f.exception && ids.has(f.exception.id)) { n++; subjects.set(f.subject, (subjects.get(f.subject) ?? 0) + 1) }
    groups.push({
      rule, exceptions: its.map((i) => i.id), owners: [...new Set(its.map((i) => i.owner))], covered: n,
      subjects: [...subjects].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)).slice(0, 3),
    })
  }
  groups.sort((a, b) => b.owners.length - a.owners.length || b.exceptions.length - a.exceptions.length || a.rule.localeCompare(b.rule))

  return {
    date: isoDay(now), withinDays, items, groups,
    counts: { active: items.filter((i) => i.state !== 'expired').length, expiring: items.filter((i) => i.state === 'expiring').length, expired: items.filter((i) => i.state === 'expired').length },
  }
}

export const when = (i: Pick<ExceptionStatus, 'daysLeft'>) =>
  i.daysLeft < 0 ? `${-i.daysLeft} day${i.daysLeft === -1 ? '' : 's'} ago` : i.daysLeft === 0 ? 'today' : `in ${i.daysLeft} day${i.daysLeft === 1 ? '' : 's'}`

export function renderExceptionsText(o: ExceptionsOverview): string {
  const out = [`Exceptions · ${o.counts.active} active (${o.counts.expiring} expiring within ${o.withinDays} days) · ${o.counts.expired} expired`, '']
  if (!o.items.length) out.push('No exception declared in ds-exceptions.yml.')
  const w = Math.max(2, ...o.items.map((i) => i.id.length)), ow = Math.max(5, ...o.items.map((i) => i.owner.length))
  for (const i of o.items)
    out.push(`${i.state.toUpperCase().padEnd(8)}  ${i.id.padEnd(w)}  ${i.owner.padEnd(ow)}  ${i.expires} (${when(i)})  ${String(i.covered).padStart(3)} covered  ${i.rules.join(', ')}`)
  if (o.groups.length) {
    out.push('', 'Similar exceptions (several exceptions for one rule: a DS component or token may be missing)')
    for (const g of o.groups)
      out.push(`  ${g.rule} · ${g.exceptions.length} exceptions (${g.exceptions.join(', ')}) · ${g.owners.length === 1 ? 'owner' : 'owners'} ${g.owners.join(', ')} · ${g.covered} covered${g.subjects.length ? ` · e.g. ${g.subjects.map((s) => s.subject).join(', ')}` : ''}`)
  }
  return out.join('\n') + '\n'
}

// ---------- Review issue ----------

export const ISSUE_MARKER = '<!-- ds-guard:exceptions-review -->'
export const ISSUE_TITLE = 'DS Guard: exceptions to review'

/** Body and assignees of the "Exceptions to review" issue: exceptions expired or expiring within `withinDays`. */
export function renderReviewIssue(o: ExceptionsOverview): { title: string; body: string; assignees: string[]; due: number } {
  const due = o.items.filter((i) => i.state !== 'active')
  // GitHub assigns users only: "@org/team" owners are mentioned, not assigned.
  const assignees = [...new Set(due.map((i) => i.owner).filter((x) => /^@[A-Za-z0-9-]+$/.test(x)).map((x) => x.slice(1)))]
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const lines = [
    ISSUE_MARKER,
    due.length
      ? `${due.length} exception${due.length === 1 ? '' : 's'} expired or expiring within ${o.withinDays} days (${o.date}). Owners: ${[...new Set(due.map((i) => i.owner))].join(', ')}.`
      : `No exception expires within ${o.withinDays} days (${o.date}).`,
    '',
  ]
  if (due.length) {
    lines.push('| Exception | Owner | Expires | Covered findings | Rules | Reason |', '| --- | --- | --- | --- | --- | --- |')
    for (const i of due) lines.push(`| \`${i.id}\` | ${cell(i.owner)} | ${i.state === 'expired' ? '**expired** ' : ''}${i.expires} (${when(i)}) | ${i.state === 'expired' ? 'count again' : i.covered} | ${i.rules.map((r) => `\`${r}\``).join(', ')} | ${cell(i.reason)}${i.link ? ` ([link](${i.link}))` : ''} |`)
    lines.push('', 'For each one, open a pull request on `ds-exceptions.yml` (the DS team approves it through `CODEOWNERS`):', '',
      '- still needed: `npx ds-guard exceptions renew <id> --until <YYYY-MM-DD>`, and say why in the PR;',
      '- fixed: `npx ds-guard exceptions close <id>` and remove its `// ds-exception: <id>` annotations.', '')
  }
  if (o.groups.some((g) => g.owners.length > 1))
    lines.push(`Similar exceptions across teams: ${o.groups.filter((g) => g.owners.length > 1).map((g) => `\`${g.rule}\` (${g.owners.join(', ')})`).join(', ')}. A DS component or token may be missing.`, '')
  lines.push('<sub>Updated weekly by DS Guard. Closing this issue does not change any exception: the registry in Git is the source of truth.</sub>')
  return { title: ISSUE_TITLE, body: lines.join('\n') + '\n', assignees, due: due.length }
}

// ---------- Editing ds-exceptions.yml ----------

export class RegistryEditError extends Error {}

/** Next free id following the registry's own pattern (EXC-007 -> EXC-008). */
export function nextExceptionId(entries: Pick<ExceptionEntry, 'id'>[]): string {
  let best: { prefix: string; n: number; width: number } | undefined
  for (const { id } of entries) {
    const m = id.match(/^(.*?)(\d+)$/)
    if (m && (!best || Number(m[2]) > best.n)) best = { prefix: m[1]!, n: Number(m[2]), width: m[2]!.length }
  }
  return best ? best.prefix + String(best.n + 1).padStart(best.width, '0') : 'EXC-001'
}

function load(text: string) {
  const doc = YAML.parseDocument(text)
  if (doc.errors.length) throw new RegistryEditError(`ds-exceptions.yml is not valid YAML: ${doc.errors[0]!.message}`)
  let seq = doc.get('exceptions', true)
  if (seq === undefined || seq === null || (YAML.isScalar(seq) && seq.value === null)) { seq = new YAML.YAMLSeq(); doc.set('exceptions', seq) }
  if (!YAML.isSeq(seq)) throw new RegistryEditError('ds-exceptions.yml: `exceptions` must be a list.')
  return { doc, seq }
}

function find(seq: YAML.YAMLSeq, id: string) {
  const i = seq.items.findIndex((n) => YAML.isMap(n) && String(n.get('id')) === id)
  if (i < 0) throw new RegistryEditError(`No exception ${id} in ds-exceptions.yml.`)
  return { index: i, node: seq.items[i] as YAML.YAMLMap }
}

const out = (doc: YAML.Document) => doc.toString({ lineWidth: 0, flowCollectionPadding: false })

function checkDate(date: string, now: Date) {
  if (!isDate(date)) throw new RegistryEditError(`--until must be a date (YYYY-MM-DD), got "${date}".`)
  if (date < isoDay(now)) throw new RegistryEditError(`--until ${date} is in the past.`)
}

export function addException(text: string, entry: ExceptionEntry, opts: { now: Date; knownRules?: Set<string> }): string {
  const missing = [!entry.id?.trim() && 'id', !entry.rules.length && 'rules', !entry.reason?.trim() && 'reason', !entry.owner?.trim() && 'owner', !entry.expires && '--until'].filter(Boolean)
  if (missing.length) throw new RegistryEditError(`Missing: ${missing.join(', ')}.`)
  const unknown = opts.knownRules ? entry.rules.filter((r) => !opts.knownRules!.has(r)) : []
  if (unknown.length) throw new RegistryEditError(`Unknown rule ${unknown.join(', ')}.`)
  checkDate(entry.expires, opts.now)
  const { doc, seq } = load(text)
  if (seq.items.some((n) => YAML.isMap(n) && String(n.get('id')) === entry.id)) throw new RegistryEditError(`Exception ${entry.id} already exists.`)
  const plain: Record<string, unknown> = { id: entry.id, rules: entry.rules, reason: entry.reason, owner: entry.owner, expires: entry.expires }
  if (entry.files?.length) plain.files = entry.files
  if (entry.link) plain.link = entry.link
  const node = doc.createNode(plain) as YAML.YAMLMap
  for (const k of ['rules', 'files']) { const v = node.get(k, true); if (YAML.isSeq(v)) v.flow = true }
  seq.flow = false
  seq.items.push(node)
  return out(doc)
}

export function renewException(text: string, id: string, until: string, opts: { now: Date }): string {
  checkDate(until, opts.now)
  const { doc, seq } = load(text)
  const { node } = find(seq, id)
  const cur = node.get('expires', true)
  if (YAML.isScalar(cur)) cur.value = until
  else node.set('expires', until)
  return out(doc)
}

/** Removes the entry: Git history keeps the record of the exception. */
export function closeException(text: string, id: string): string {
  const { doc, seq } = load(text)
  seq.items.splice(find(seq, id).index, 1)
  return out(doc)
}

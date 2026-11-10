// Renderers: terminal text, PR comment (Markdown), detailed HTML report and the one-page
// leadership report (ADR 0014). Pure string functions, so they run anywhere.

import { ALL_RULES } from './engine.js'
import { explained, type Tally } from './metrics.js'
import { when } from './registry.js'
import type { Summary } from './summary.js'
import type { Finding } from './types.js'

export interface Snapshot {
  date: string
  explainedCoverage: number | null
  rawCoverage: number | null
  conformance: number | null
  blocking: number
  exceptionsActive: number
  versions: string[]
}

export const toSnapshot = (s: Summary): Snapshot => ({
  date: s.date, explainedCoverage: s.metrics.explainedCoverage, rawCoverage: s.metrics.rawCoverage, conformance: s.metrics.conformance,
  blocking: s.blocking.length, exceptionsActive: s.exceptions.active, versions: s.versions.map((v) => `${v.name}@${v.version}`),
})

export const pct = (n: number | null) => (n === null ? 'n/a' : `${Math.round(n * 100)}%`)
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const where = (f: Finding) => `${f.loc.file}:${f.loc.line}`

function groupByRule(fs: Finding[]): [string, Finding[]][] {
  const order = new Map(ALL_RULES.map((r, i) => [r.id, i]))
  const sev = { error: 0, warning: 1, info: 2 }
  const g = new Map<string, Finding[]>()
  for (const f of fs) (g.get(f.ruleId) ?? g.set(f.ruleId, []).get(f.ruleId)!).push(f)
  return [...g].sort((a, b) => sev[a[1][0]!.severity] - sev[b[1][0]!.severity] || (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99))
}
const fileCount = (fs: Finding[]) => new Set(fs.map((f) => f.loc.file)).size
const versions = (s: Summary) => s.versions.map((v) => `${v.name}@${v.version}`).join(', ')

// ---------- Terminal ----------

export function renderText(s: Summary, opts: { maxPerRule?: number; findings?: Finding[] } = {}): string {
  const max = opts.maxPerRule ?? 10
  const open = opts.findings ?? s.open
  const m = s.metrics
  const out = [
    `DS Guard · ${versions(s)} (lockfile)`,
    `Explained coverage ${pct(m.explainedCoverage)} (raw ${pct(m.rawCoverage)}) · Conformance ${pct(m.conformance)} · definition ${m.definition}`,
    `${plural(open.filter((f) => f.severity === 'error').length, 'error')}, ${plural(open.filter((f) => f.severity === 'warning').length, 'warning')}, ${open.filter((f) => f.severity === 'info').length} info · ${s.excepted.length} covered by exceptions · ${s.blocking.length} blocking`,
    '',
  ]
  for (const [rule, fs] of groupByRule(open)) {
    out.push(`${rule} (${fs[0]!.severity}) · ${plural(fs.length, 'finding')} in ${plural(fileCount(fs), 'file')}`)
    for (const f of fs.slice(0, max)) out.push(`  ${f.loc.file}:${f.loc.line}:${f.loc.column}  ${f.message}`)
    if (fs.length > max) out.push(`  … ${fs.length - max} more (use --all)`)
    out.push('')
  }
  for (const e of s.exceptions.expiringSoon) out.push(`Exception ${e.id} (${e.owner}) expires on ${e.expires}.`)
  for (const e of s.parseErrors) out.push(`Could not parse ${e.path}: ${e.message}`)
  return out.join('\n').trimEnd() + '\n'
}

// ---------- PR comment ----------

export const COMMENT_MARKER = '<!-- ds-guard:pr-comment -->'

export function renderMarkdown(s: Summary, opts: { findings?: Finding[]; scope?: string; maxPerRule?: number; excepted?: Finding[] } = {}): string {
  const max = opts.maxPerRule ?? 8
  const open = opts.findings ?? s.open
  const excepted = opts.excepted ?? s.excepted
  const blocking = open.filter((f) => s.blocking.includes(f))
  const m = s.metrics
  const lines = [
    COMMENT_MARKER,
    '### DS Guard',
    '',
    `**Explained coverage** ${pct(m.explainedCoverage)} · **Conformance** ${pct(m.conformance)} · checked against \`${versions(s)}\` (lockfile)`,
    '',
    blocking.length ? `❌ **${plural(blocking.length, 'blocking accessibility issue')}**` : '✅ No blocking issue.',
    '',
    open.length
      ? `${plural(open.length, 'finding')} ${opts.scope ?? ''}`.trim() + `: ${['error', 'warning', 'info'].map((sev) => [sev, open.filter((f) => f.severity === sev).length] as const).filter(([, n]) => n).map(([sev, n]) => `${n} ${sev}`).join(', ')}` + (excepted.length ? ` · ${excepted.length} covered by declared exceptions` : '') + '.'
      : `No finding ${opts.scope ?? ''}`.trim() + (excepted.length ? ` · ${excepted.length} covered by declared exceptions.` : '.'),
    '',
  ]
  for (const [rule, fs] of groupByRule(open)) {
    lines.push(`<details${fs[0]!.severity === 'error' ? ' open' : ''}><summary><code>${rule}</code> · ${fs.length} in ${plural(fileCount(fs), 'file')}</summary>`, '')
    for (const f of fs.slice(0, max)) lines.push(`- \`${where(f)}\` ${f.message}`)
    if (fs.length > max) lines.push(`- … ${fs.length - max} more: run \`npx ds-guard scan\` locally.`)
    lines.push('', '</details>', '')
  }
  if (s.exceptions.expiringSoon.length) lines.push(`⏳ Expiring within 30 days: ${s.exceptions.expiringSoon.map((e) => `\`${e.id}\` (${e.owner}, ${e.expires})`).join(', ')}.`, '')
  lines.push('<sub>Non-blocking except accessibility. An intentional deviation? Declare it in <code>ds-exceptions.yml</code> and annotate the line with <code>// ds-exception: ID</code>.</sub>')
  return lines.join('\n') + '\n'
}

// ---------- HTML ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>')

const CSS = `
:root{--bg:#fbfbfa;--fg:#1d2125;--muted:#5d6670;--line:#e3e5e8;--card:#fff;--accent:#0e7c86;--bad:#b42318;--warn:#9a6700;--ok:#1a7f37}
@media (prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8eaed;--muted:#a0a8b1;--line:#2c3237;--card:#1b1f23;--accent:#4fb8c1;--bad:#f97066;--warn:#e3b341;--ok:#56d364}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:960px;margin:0 auto;padding:32px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:32px 0 8px}
.muted{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}.big{font-size:40px;font-weight:650;letter-spacing:-.02em;line-height:1.1}
.bad{color:var(--bad)}.warn{color:var(--warn)}.ok{color:var(--ok)}table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:500}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}code{font:13px ui-monospace,Menlo,Consolas,monospace;overflow-wrap:anywhere}
.bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;display:flex}.bar i{display:block;height:100%}
footer{margin-top:40px;font-size:13px}@media print{body{background:#fff}main{padding:0}}`

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>\n`

function bar(t: Tally): string {
  const n = t.ds + t.excepted + t.unexplained || 1
  return `<div class="bar" title="DS ${t.ds} · excepted ${t.excepted} · unexplained ${t.unexplained}"><i style="width:${(t.ds / n) * 100}%;background:var(--accent)"></i><i style="width:${(t.excepted / n) * 100}%;background:var(--warn)"></i></div>`
}

const delta = (now: number | null, before: number | null | undefined) => {
  if (now === null || before === null || before === undefined) return ''
  const d = Math.round((now - before) * 100)
  return d === 0 ? ' <span class="muted">(=)</span>' : ` <span class="${d > 0 ? 'ok' : 'bad'}">(${d > 0 ? '+' : ''}${d} pts)</span>`
}

function exceptionsLine(s: Summary): string {
  const o = s.exceptions.overview
  if (!o.items.length) return ''
  const cross = o.groups.filter((g) => g.owners.length > 1)
  return `<p><strong>Exceptions:</strong> ${o.counts.active} active, ${o.counts.expiring} to renew or close within ${o.withinDays} days, <span class="${o.counts.expired ? 'bad' : ''}">${o.counts.expired} expired</span>${cross.length ? `; ${cross.length === 1 ? 'one rule is' : `${cross.length} rules are`} excepted by several teams (${cross.slice(0, 3).map((g) => `<code>${g.rule}</code>`).join(', ')}), a sign the DS may be missing a component or token` : ''}.</p>`
}

export function renderLeadership(s: Summary, opts: { project: string; history?: Snapshot[] }): string {
  const m = s.metrics
  const prev = (opts.history ?? []).filter((h) => h.date < s.date).at(-1)
  const top = m.byArea.filter((a) => a.total.unexplained > 0).slice(0, 5)
  const gap = m.total.unexplained
  const body = `
<h1>Design system compliance · ${esc(opts.project)}</h1>
<div class="muted">${s.date} · checked against ${esc(versions(s))} as resolved in the lockfile</div>
<div class="grid">
  <div class="card"><div class="muted">Explained coverage</div><div class="big">${pct(m.explainedCoverage)}${delta(m.explainedCoverage, prev?.explainedCoverage)}</div><div class="muted">UI built from the DS or covered by a declared exception</div></div>
  <div class="card"><div class="muted">Conformance</div><div class="big">${pct(m.conformance)}${delta(m.conformance, prev?.conformance)}</div><div class="muted">DS usages that follow the current contract</div></div>
  <div class="card"><div class="muted">Blocking accessibility issues</div><div class="big ${s.blocking.length ? 'bad' : 'ok'}">${s.blocking.length}</div><div class="muted">${s.blocking.length ? 'to fix before merging' : 'none open'}</div></div>
  <div class="card"><div class="muted">Declared exceptions</div><div class="big">${s.exceptions.active}</div><div class="muted">${s.exceptions.expiringSoon.length} expiring within 30 days · <span class="${s.exceptions.expired.length ? 'bad' : ''}">${s.exceptions.expired.length} expired</span></div></div>
</div>
<h2>What it means</h2>
<p>${pct(m.explainedCoverage)} of the measured interface is either built from the design system or a deviation someone owns and has dated. The remaining <strong>${gap}</strong> item${gap === 1 ? ' is' : 's are'} unexplained debt${top[0] ? `, mostly in <code>${esc(top[0].area)}</code>` : ''}. 100% is not the goal: an owned, dated exception is a legitimate decision.</p>
${exceptionsLine(s)}
${top.length ? `<h2>Where the unexplained gap is</h2><table><tr><th>Area</th><th class="n">Unexplained</th><th class="n">Explained coverage</th><th style="width:30%"></th></tr>${top.map((a) => `<tr><td><code>${esc(a.area)}</code></td><td class="n">${a.total.unexplained}</td><td class="n">${pct(a.explainedCoverage)}</td><td>${bar(a.total)}</td></tr>`).join('')}</table>` : ''}
${s.exceptions.byOwner.length ? `<h2>Exceptions by owner</h2><table><tr><th>Owner</th><th class="n">Active exceptions</th><th class="n">Items covered</th></tr>${s.exceptions.byOwner.slice(0, 6).map((o) => `<tr><td>${esc(o.owner)}</td><td class="n">${o.active}</td><td class="n">${o.covered}</td></tr>`).join('')}</table>` : ''}
${(opts.history?.length ?? 0) > 1 ? `<h2>Trend</h2><table><tr><th>Date</th><th class="n">Explained coverage</th><th class="n">Conformance</th><th class="n">Blocking</th><th class="n">Exceptions</th><th>DS version</th></tr>${opts.history!.slice(-6).map((h) => `<tr><td>${h.date}</td><td class="n">${pct(h.explainedCoverage)}</td><td class="n">${pct(h.conformance)}</td><td class="n">${h.blocking}</td><td class="n">${h.exceptionsActive}</td><td><code>${esc(h.versions.join(', '))}</code></td></tr>`).join('')}</table>` : ''}
<footer class="muted">Metrics definition ${m.definition}: coverage counts DS components (directly or through in-house wrappers), native elements the DS replaces, and colour, spacing, radius and font-size values. Computed locally; no code left the machine.</footer>`
  return page(`DS compliance · ${opts.project}`, body)
}

function exceptionsSection(s: Summary): string {
  const o = s.exceptions.overview
  if (!o.items.length) return ''
  const cls = { expired: 'bad', expiring: 'warn', active: '' }
  const rows = o.items.map((i) => `<tr><td><code>${esc(i.id)}</code></td><td>${esc(i.owner)}</td><td class="${cls[i.state]}">${i.state}</td><td>${i.expires} <span class="muted">${when(i)}</span></td><td class="n">${i.covered}</td><td><code>${esc(i.rules.join(', '))}</code></td><td>${esc(i.reason)}${i.link ? ` <a href="${esc(i.link)}">link</a>` : ''}</td></tr>`).join('')
  const groups = o.groups.length
    ? `<h2>Similar exceptions</h2><p class="muted">Several exceptions for the same rule often mean the DS lacks a component or a token.</p><table><tr><th>Rule</th><th>Exceptions</th><th>Owners</th><th class="n">Covered</th><th>Examples</th></tr>${o.groups.map((g) => `<tr><td><code>${g.rule}</code></td><td><code>${esc(g.exceptions.join(', '))}</code></td><td>${esc(g.owners.join(', '))}</td><td class="n">${g.covered}</td><td><code>${esc(g.subjects.map((x) => x.subject).join(', '))}</code></td></tr>`).join('')}</table>`
    : ''
  return `<h2 id="exceptions">Exceptions <span class="muted">· ${o.counts.active} active · ${o.counts.expiring} expiring within ${o.withinDays} days · ${o.counts.expired} expired</span></h2><table><tr><th>ID</th><th>Owner</th><th>State</th><th>Expires</th><th class="n">Covered</th><th>Rules</th><th>Reason</th></tr>${rows}</table>${groups}`
}

export function renderHtmlReport(s: Summary, opts: { project: string }): string {
  const m = s.metrics
  const row = (label: string, t: Tally) => `<tr><td>${label}</td><td class="n">${t.ds}</td><td class="n">${t.excepted}</td><td class="n">${t.unexplained}</td><td class="n">${pct(explained(t))}</td><td style="width:25%">${bar(t)}</td></tr>`
  const findings = groupByRule(s.open).map(([rule, fs]) => `<h2><code>${rule}</code> <span class="muted">· ${fs[0]!.severity} · ${fs.length}</span></h2><table>${fs.map((f) => `<tr><td style="width:32%"><code>${esc(f.loc.file)}:${f.loc.line}</code></td><td>${md(f.message)}</td></tr>`).join('')}</table>`).join('')
  const body = `
<h1>DS Guard report · ${esc(opts.project)}</h1>
<div class="muted">${s.date} · definition ${m.definition}</div>
<div class="grid">
  <div class="card"><div class="muted">Explained coverage</div><div class="big">${pct(m.explainedCoverage)}</div><div class="muted">raw ${pct(m.rawCoverage)}</div></div>
  <div class="card"><div class="muted">Conformance</div><div class="big">${pct(m.conformance)}</div><div class="muted">${m.nonConformingUsages} of ${m.dsUsages} DS usages off-contract</div></div>
  <div class="card"><div class="muted">Open findings</div><div class="big">${s.open.length}</div><div class="muted">${s.counts.error} error · ${s.counts.warning} warning · ${s.counts.info} info</div></div>
</div>
<h2>Coverage</h2><table><tr><th></th><th class="n">From DS</th><th class="n">Excepted</th><th class="n">Unexplained</th><th class="n">Explained</th><th></th></tr>${row('Components', m.components)}${row('Style values', m.styles)}${row('<strong>Total</strong>', m.total)}</table>
<h2>Versions</h2><table><tr><th>Package</th><th>Version (lockfile)</th><th>Entry points</th><th>Tokens</th><th class="n">Deprecated APIs in use</th></tr>${s.versions.map((v) => `<tr><td><code>${esc(v.name)}</code></td><td>${esc(v.version)}</td><td><code>${esc(v.entryPoints.join(', '))}</code></td><td><code>${esc(v.tokenSources.join(', ') || '—')}</code></td><td class="n">${v.deprecatedInUse}</td></tr>`).join('')}</table>
<h2>Areas</h2><table><tr><th>Area</th><th class="n">From DS</th><th class="n">Excepted</th><th class="n">Unexplained</th><th class="n">Explained</th><th></th></tr>${m.byArea.map((a) => row(`<code>${esc(a.area)}</code>`, a.total)).join('')}</table>
<h2>Most used components</h2><table><tr><th>Component</th><th class="n">Direct</th><th class="n">Via wrappers</th></tr>${m.byComponent.slice(0, 15).map((c) => `<tr><td><code>${esc(c.component)}</code> <span class="muted">${esc(c.pkg)}</span></td><td class="n">${c.direct}</td><td class="n">${c.viaWrapper}</td></tr>`).join('')}</table>
${m.wrappers.length ? `<h2>In-house wrappers</h2><table>${m.wrappers.map((w) => `<tr><td><code>${esc(w.wrapper)}</code></td><td>→ <code>${esc(w.component)}</code></td></tr>`).join('')}</table>` : ''}
${exceptionsSection(s)}
${s.excepted.length ? `<h2>Covered by exceptions</h2><table>${s.excepted.map((f) => `<tr><td style="width:32%"><code>${esc(f.loc.file)}:${f.loc.line}</code></td><td><code>${esc(f.exception!.id)}</code> ${esc(f.exception!.owner)} · until ${f.exception!.expires}</td><td><code>${f.ruleId}</code></td></tr>`).join('')}</table>` : ''}
${findings}
<footer class="muted">Generated locally by DS Guard. No code left the machine.</footer>`
  return page(`DS Guard report · ${opts.project}`, body)
}

// Explained coverage and conformance (ADR 0011). The definition is versioned: change the
// counting rules below => bump METRICS_DEFINITION and document it in docs/mesures.md.

import type { ResolvedElement } from './resolve.js'
import { dsEquivalent } from './rules.js'
import { TokenIndex } from './tokens.js'
import type { UiDocument } from './model.js'
import type { Contract, Finding } from './types.js'
import { PROP_GROUPS } from './values.js'

export const METRICS_DEFINITION = '1.1'

const HARDCODED = new Set(['no-hardcoded-color', 'no-hardcoded-spacing', 'no-hardcoded-radius', 'no-hardcoded-font-size', 'no-off-theme-utility'])
const CONFORMANCE_RULES = new Set(['no-deprecated-component', 'no-deprecated-prop', 'no-invalid-prop-value', 'no-deprecated-token', 'no-unknown-token'])

export interface Tally {
  /** UI built from the DS: DS components (directly or via wrappers) and DS token references. */
  ds: number
  /** Custom UI covered by a live exception. */
  excepted: number
  /** Custom UI without explanation: native elements the DS replaces, hard-coded values. */
  unexplained: number
}

export interface Metrics {
  definition: string
  components: Tally
  styles: Tally
  total: Tally
  /** (ds + excepted) / all, 0..1; null when nothing was counted. */
  explainedCoverage: number | null
  /** ds / all, 0..1. */
  rawCoverage: number | null
  /** Share of DS usages that respect the contract (no deprecated API, no invalid value), 0..1. */
  conformance: number | null
  dsUsages: number
  nonConformingUsages: number
  byArea: { area: string; total: Tally; explainedCoverage: number | null }[]
  byComponent: { pkg: string; component: string; direct: number; viaWrapper: number }[]
  wrappers: { wrapper: string; component: string }[]
}

const empty = (): Tally => ({ ds: 0, excepted: 0, unexplained: 0 })
const sum = (a: Tally, b: Tally): Tally => ({ ds: a.ds + b.ds, excepted: a.excepted + b.excepted, unexplained: a.unexplained + b.unexplained })
const all = (t: Tally) => t.ds + t.excepted + t.unexplained
const ratio = (n: number, d: number) => (d ? n / d : null)
export const explained = (t: Tally) => ratio(t.ds + t.excepted, all(t))

/** Area = first two path segments ("src/billing"), the unit a leadership page talks about. */
export const areaOf = (file: string) => file.split('/').slice(0, file.split('/').length > 2 ? 2 : 1).join('/')

export function computeMetrics(docs: UiDocument[], elements: ResolvedElement[], findings: Finding[], contract: Contract): Metrics {
  const tokens = new TokenIndex(contract)
  const areas = new Map<string, Tally>()
  const bump = (file: string, key: keyof Tally, t: Tally) => {
    t[key]++
    const a = areas.get(areaOf(file)) ?? areas.set(areaOf(file), empty()).get(areaOf(file))!
    a[key]++
  }
  const at = (f: { loc: { file: string; line: number; column: number } }) => `${f.loc.file}:${f.loc.line}:${f.loc.column}`

  // Components: DS elements vs native elements the DS has a component for.
  const components = empty()
  const preferFindings = new Map(findings.filter((f) => f.ruleId === 'prefer-ds-component').map((f) => [at(f), f]))
  const byComponent = new Map<string, { pkg: string; component: string; direct: number; viaWrapper: number }>()
  const wrappers = new Map<string, string>()
  for (const e of elements) {
    if (e.origin.kind === 'ds') {
      bump(e.doc.path, 'ds', components)
      const key = e.origin.pkg + '#' + e.origin.component
      const c = byComponent.get(key) ?? byComponent.set(key, { pkg: e.origin.pkg, component: e.origin.component, direct: 0, viaWrapper: 0 }).get(key)!
      if (e.origin.via.length) { c.viaWrapper++; for (const w of e.origin.via) wrappers.set(w, e.origin.component) } else c.direct++
    } else if (e.origin.kind === 'intrinsic' && dsEquivalent(e.el.tag, contract)) {
      bump(e.doc.path, preferFindings.get(at({ loc: e.el.loc }))?.exception ? 'excepted' : 'unexplained', components)
    }
  }

  // Styles: tracked declarations using DS tokens vs hard-coded literals.
  const styles = empty()
  for (const doc of docs) for (const d of doc.styles) {
    const group = (Object.keys(PROP_GROUPS) as (keyof typeof PROP_GROUPS)[]).find((g) => PROP_GROUPS[g].test(d.prop))
    if (!group) continue
    for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) if (tokens.byVar.has(m[1]!)) bump(doc.path, 'ds', styles)
  }
  for (const f of findings) if (HARDCODED.has(f.ruleId)) bump(f.loc.file, f.exception ? 'excepted' : 'unexplained', styles)

  // Conformance: DS usages with an unexcepted contract violation, counted once per location.
  const dsUsages = components.ds + styles.ds
  const bad = new Set(findings.filter((f) => CONFORMANCE_RULES.has(f.ruleId) && !f.exception).map((f) => `${f.loc.file}:${f.loc.line}`))
  const nonConformingUsages = Math.min(bad.size, dsUsages)

  const total = sum(components, styles)
  return {
    definition: METRICS_DEFINITION,
    components, styles, total,
    explainedCoverage: explained(total),
    rawCoverage: ratio(total.ds, all(total)),
    conformance: ratio(dsUsages - nonConformingUsages, dsUsages),
    dsUsages, nonConformingUsages,
    byArea: [...areas].map(([area, t]) => ({ area, total: t, explainedCoverage: explained(t) })).sort((a, b) => b.total.unexplained - a.total.unexplained),
    byComponent: [...byComponent.values()].sort((a, b) => b.direct + b.viaWrapper - (a.direct + a.viaWrapper)),
    wrappers: [...wrappers].map(([wrapper, component]) => ({ wrapper, component })),
  }
}

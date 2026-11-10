import { ALL_RULES, type ScanResult } from './engine.js'
import { isExpired } from './exceptions.js'
import { computeMetrics, type Metrics } from './metrics.js'
import { exceptionsOverview, type ExceptionsOverview } from './registry.js'
import type { Config, Contract, Finding } from './types.js'

export interface Summary {
  date: string
  metrics: Metrics
  /** Findings not covered by an exception. */
  open: Finding[]
  excepted: Finding[]
  /** Open findings of blocking rules (accessibility by default, ADR 0010). */
  blocking: Finding[]
  counts: Record<'error' | 'warning' | 'info', number>
  exceptions: {
    active: number
    expiringSoon: { id: string; owner: string; expires: string }[]
    expired: { id: string; owner: string; expires: string }[]
    byOwner: { owner: string; active: number; covered: number }[]
    /** Every exception sorted by expiry, with similarity groups (expiring = within 30 days). */
    overview: ExceptionsOverview
  }
  versions: { name: string; version: string; entryPoints: string[]; tokenSources: string[]; deprecatedInUse: number }[]
  parseErrors: { path: string; message: string }[]
}

export const blockingRules = (config: Config) => new Set(config.blocking ?? ALL_RULES.filter((r) => r.category === 'a11y').map((r) => r.id))

const DAY = 86_400_000

export function summarize(result: ScanResult, contract: Contract, config: Config, now: Date): Summary {
  const metrics = computeMetrics(result.docs, result.elements, result.findings, contract)
  const open = result.findings.filter((f) => !f.exception)
  const excepted = result.findings.filter((f) => f.exception)
  const block = blockingRules(config)
  const counts = { error: 0, warning: 0, info: 0 }
  for (const f of open) counts[f.severity]++

  const entries = result.registry?.entries ?? []
  const soon = new Date(now.getTime() + 30 * DAY)
  const covered = new Map<string, number>()
  for (const f of excepted) covered.set(f.exception!.owner, (covered.get(f.exception!.owner) ?? 0) + 1)
  const owners = new Map<string, number>()
  for (const e of entries) if (!isExpired(e, now)) owners.set(e.owner, (owners.get(e.owner) ?? 0) + 1)
  const pick = ({ id, owner, expires }: { id: string; owner: string; expires: string }) => ({ id, owner, expires })

  const deprecated = new Set(['no-deprecated-component', 'no-deprecated-prop', 'no-deprecated-token'])
  return {
    date: now.toISOString().slice(0, 10),
    metrics, open, excepted,
    blocking: open.filter((f) => block.has(f.ruleId)),
    counts,
    exceptions: {
      active: entries.filter((e) => !isExpired(e, now)).length,
      expiringSoon: entries.filter((e) => !isExpired(e, now) && e.expires <= soon.toISOString().slice(0, 10)).map(pick),
      expired: entries.filter((e) => isExpired(e, now)).map(pick),
      overview: exceptionsOverview(entries, excepted, now, 30),
      byOwner: [...owners].map(([owner, active]) => ({ owner, active, covered: covered.get(owner) ?? 0 })).sort((a, b) => b.covered - a.covered),
    },
    versions: contract.packages.map((p) => ({
      name: p.name, version: p.version, entryPoints: p.entryPoints,
      tokenSources: (p.tokenSources ?? []).map((t) => `${t.package}@${t.version}`).filter((v, i, a) => a.indexOf(v) === i),
      deprecatedInUse: open.filter((f) => deprecated.has(f.ruleId)).length,
    })),
    parseErrors: result.parseErrors,
  }
}

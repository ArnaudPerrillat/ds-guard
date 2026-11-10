import type { UiDocument } from './model.js'
import { Resolver } from './resolve.js'
import { toDocuments } from './documents.js'
import { EXCEPTION_RULES, parseExceptions, applyExceptions } from './exceptions.js'
import { RULES, type Rule, type RuleMeta } from './rules.js'
import { TokenIndex } from './tokens.js'
import { expandTailwind } from './tailwind.js'
import type { Config, Contract, Finding, Severity, SourceFile } from './types.js'

export interface EngineOptions {
  /** Import aliases, e.g. { "@": "src" } from tsconfig paths. */
  aliases?: Record<string, string>
  /** Restrict to these rule ids (the ESLint plugin runs one rule at a time). */
  only?: string[]
}

export function runRules(parsed: UiDocument[], contract: Contract, config: Config = {}, opts: EngineOptions = {}) {
  const tokens = new TokenIndex(contract)
  // Tailwind classes become style declarations, so the token rules and metrics see them (ADR 0018).
  const docs = expandTailwind(parsed, tokens)
  const resolver = new Resolver(docs, contract, opts.aliases)
  const ctx = { docs, contract, tokens, elements: resolver.elements() }
  const findings: Finding[] = []
  for (const rule of RULES) {
    if (opts.only && !opts.only.includes(rule.id)) continue
    const severity = config.rules?.[rule.id]?.severity ?? rule.severity
    if (severity === 'off') continue
    rule.check(ctx, (f) => findings.push({ ruleId: rule.id, severity, ...f }))
  }
  findings.sort((a, b) => a.loc.file.localeCompare(b.loc.file) || a.loc.line - b.loc.line || a.loc.column - b.loc.column)
  return { findings, docs, elements: ctx.elements, tokens: ctx.tokens }
}

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id)
}

export const ALL_RULES: RuleMeta[] = [...RULES.map(({ id, severity, category, description }) => ({ id, severity, category, description })), ...EXCEPTION_RULES]

export function severityFor(config: Config, id: string): Severity | 'off' {
  return config.rules?.[id]?.severity ?? ALL_RULES.find((r) => r.id === id)?.severity ?? 'warning'
}

export interface ScanInput {
  files: SourceFile[]
  contract: Contract
  config?: Config
  /** Content of ds-exceptions.yml, if any. */
  exceptions?: { path: string; content: string }
  /** Evaluation date for exception expiry (injected: the engine reads no clock). */
  now: Date
  options?: EngineOptions
}

export function scan(input: ScanInput) {
  const config = input.config ?? {}
  const { docs: parsed, errors } = toDocuments(input.files)
  const { findings, docs, elements } = runRules(parsed, input.contract, config, input.options)
  const registry = input.exceptions ? parseExceptions(input.exceptions.content, input.exceptions.path, new Set(ALL_RULES.map((r) => r.id))) : undefined
  const all = applyExceptions(findings, docs, registry, input.now, (id) => severityFor(config, id))
  return { findings: all, docs, elements, registry, parseErrors: errors }
}

export type ScanResult = ReturnType<typeof scan>

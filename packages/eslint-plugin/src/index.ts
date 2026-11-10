// DS Guard rules for ESLint. The contract is read from `.ds-guard/contract.json`, written by
// `ds-guard contract` (or any `ds-guard scan`), so ESLint never builds a TypeScript program per file.

import fs from 'node:fs'
import path from 'node:path'
import { ALL_RULES, EXCEPTIONS_FILE, scan, type Contract, type Finding, type RuleMeta } from '@ds-guard/core'

interface Settings { root?: string; contract?: string }

interface RuleContext {
  filename: string
  cwd: string
  sourceCode: { text: string }
  settings: { 'ds-guard'?: Settings }
  report(d: { loc: { line: number; column: number }; message: string }): void
}

const contracts = new Map<string, Contract>()
const results = new Map<string, Finding[]>()

function load(ctx: RuleContext): { root: string; contract: Contract; exceptions?: { path: string; content: string } } {
  const s = ctx.settings['ds-guard'] ?? {}
  const root = path.resolve(ctx.cwd, s.root ?? '.')
  const file = path.resolve(root, s.contract ?? '.ds-guard/contract.json')
  let contract = contracts.get(file)
  if (!contract) {
    if (!fs.existsSync(file)) throw new Error(`DS Guard: ${file} not found. Run \`npx ds-guard contract\` once (and after each DS upgrade).`)
    contract = JSON.parse(fs.readFileSync(file, 'utf8')) as Contract
    contracts.set(file, contract)
  }
  const exFile = path.join(root, EXCEPTIONS_FILE)
  const exceptions = fs.existsSync(exFile) ? { path: EXCEPTIONS_FILE, content: fs.readFileSync(exFile, 'utf8') } : undefined
  return { root, contract, exceptions }
}

/** One scan per file text, shared by all rules. */
function findingsFor(ctx: RuleContext): Finding[] {
  const key = ctx.filename + '\0' + ctx.sourceCode.text
  const cached = results.get(key)
  if (cached) return cached
  const { root, contract, exceptions } = load(ctx)
  const rel = path.relative(root, ctx.filename).split(path.sep).join('/')
  const { findings } = scan({ files: [{ path: rel, content: ctx.sourceCode.text }], contract, exceptions, now: new Date() })
  if (results.size > 500) results.clear()
  results.set(key, findings)
  return findings
}

function makeRule(meta: RuleMeta) {
  return {
    meta: { type: meta.category === 'a11y' ? 'problem' : 'suggestion', docs: { description: meta.description }, schema: [] },
    create(ctx: RuleContext) {
      return {
        'Program:exit'() {
          for (const f of findingsFor(ctx)) {
            if (f.ruleId !== meta.id || f.exception) continue
            ctx.report({ loc: { line: f.loc.line, column: Math.max(0, f.loc.column - 1) }, message: f.message + (f.fix && !f.message.includes(f.fix.description) ? ` (${f.fix.description})` : '') })
          }
        },
      }
    },
  }
}

const rules = Object.fromEntries(ALL_RULES.map((r) => [r.id, makeRule(r)]))

const plugin = {
  meta: { name: '@ds-guard/eslint-plugin', version: '0.1.0' },
  rules,
  configs: {} as Record<string, unknown>,
}

plugin.configs.recommended = {
  name: '@ds-guard/recommended',
  plugins: { '@ds-guard': plugin },
  rules: Object.fromEntries(ALL_RULES.map((r) => [`@ds-guard/${r.id}`, r.severity === 'error' ? 'error' : 'warn'])),
}

export default plugin

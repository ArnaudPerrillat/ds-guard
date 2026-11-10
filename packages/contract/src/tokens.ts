// Tokens from DTCG JSON (the pivot format) or from CSS custom properties.

import fs from 'node:fs'
import { normColor, parseTailwindTheme, toPx, type TailwindTheme, type Token, type TokenType } from '@ds-guard/core'

export function readTokenFile(file: string): Token[] {
  const text = fs.readFileSync(file, 'utf8')
  return file.endsWith('.json') ? fromDtcg(JSON.parse(text)) : fromCss(text)
}

type Node = Record<string, unknown>

export function fromDtcg(root: Node): Token[] {
  const flat = new Map<string, { value: unknown; type?: string; deprecated?: string }>()
  const walk = (node: Node, path: string[], inherited?: string) => {
    const type = typeof node.$type === 'string' ? node.$type : inherited
    if ('$value' in node) {
      const dep = node.$deprecated
      flat.set(path.join('.'), { value: node.$value, type, deprecated: dep === true ? '' : typeof dep === 'string' ? dep : undefined })
      return
    }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$') && v && typeof v === 'object') walk(v as Node, [...path, k], type)
  }
  walk(root, [])
  const resolve = (v: unknown, depth = 0): unknown => {
    const m = typeof v === 'string' ? v.match(/^\{([^}]+)\}$/) : null
    return m && depth < 10 && flat.has(m[1]!) ? resolve(flat.get(m[1]!)!.value, depth + 1) : v
  }
  const tokens: Token[] = []
  for (const [name, t] of flat) {
    const value = resolve(t.value)
    if (typeof value !== 'string' && typeof value !== 'number') continue // composite tokens (shadows, typography) are not matched in v1
    const v = String(value)
    const token: Token = { name, cssVar: '--' + name.replaceAll('.', '-'), values: [v], type: classify(name, v, t.type) }
    if (t.deprecated !== undefined) token.deprecated = t.deprecated || 'deprecated'
    tokens.push(token)
  }
  return tokens
}

export function fromCss(css: string): Token[] {
  const raw = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)].map((m) => ({ cssVar: m[1]!, value: m[2]!.trim() }))
  const byVar = new Map<string, string>()
  for (const r of raw) if (!byVar.has(r.cssVar)) byVar.set(r.cssVar, r.value)
  const resolve = (v: string, depth = 0): string => {
    const m = v.match(/^var\(\s*(--[\w-]+)\s*\)$/)
    return m && depth < 10 && byVar.has(m[1]!) ? resolve(byVar.get(m[1]!)!, depth + 1) : v
  }
  const tokens = new Map<string, Token>()
  for (const r of raw) {
    const v = resolve(r.value)
    const t = tokens.get(r.cssVar)
    if (t) { if (!t.values.includes(v)) t.values.push(v); continue } // same token in another theme
    const name = r.cssVar.slice(2)
    tokens.set(r.cssVar, { name, cssVar: r.cssVar, values: [v], type: classify(name, v) })
  }
  return [...tokens.values()]
}

function classify(name: string, value: string, dtcgType?: string): TokenType {
  const n = name.toLowerCase()
  if (/shadow/.test(n) || dtcgType === 'shadow') return 'shadow'
  if (/radius|rounded/.test(n)) return 'radius'
  if (/font-?size|font\.size|text-?size|fontsize/.test(n)) return 'fontSize'
  // Tailwind v4 theme namespace: --text-sm is a font size (--text-sm--line-height is not).
  if (/^text-\w+(-\w+)*$/.test(n) && toPx(value) !== null) return 'fontSize'
  if (dtcgType === 'color' || normColor(value)) return 'color'
  if (dtcgType === 'dimension' || toPx(value) !== null) return 'dimension'
  return 'other'
}

/** All custom property names defined in the CSS files of a package (any theme). */
export function definedVars(dir: string, depth = 6, out = new Set<string>()): Set<string> {
  if (depth < 0) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) definedVars(p, depth - 1, out)
    else if (e.name.endsWith('.css')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/(--[\w-]+)\s*:/g)) out.add(m[1]!)
  }
  return out
}

/** CSS files of a package (depth-limited), for @theme discovery. */
export function cssFiles(dir: string, depth = 6, out: string[] = []): string[] {
  if (depth < 0) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) cssFiles(p, depth - 1, out)
    else if (e.name.endsWith('.css')) out.push(p)
  }
  return out
}

/** Merged Tailwind v4 theme of a set of CSS files, read statically (ADR 0018). Undefined when none has @theme. */
export function tailwindTheme(files: string[]): TailwindTheme | undefined {
  const vars = new Set<string>(), resets = new Set<string>()
  let found = false
  for (const f of files) {
    const t = parseTailwindTheme(fs.readFileSync(f, 'utf8'))
    if (!t) continue
    found = true
    t.vars.forEach((v) => vars.add(v))
    t.resets.forEach((r) => resets.add(r))
  }
  return found ? { vars: [...vars].sort(), resets: [...resets].sort() } : undefined
}

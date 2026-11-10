// Tailwind CSS support (ADR 0018). Class names are read statically (className, class helpers, @apply)
// and translated into the style declarations the token rules already check: `bg-[#5b6472]` becomes
// `background-color: #5b6472`, `bg-brand` becomes `background-color: var(--color-brand)` when the DS
// theme defines it. Anything we cannot read with certainty produces nothing.

import type { StyleDecl, TailwindOrigin, UiDocument } from './model.js'
import type { TailwindTheme, Token } from './types.js'
import type { TokenIndex, ValueKind } from './tokens.js'
import { normColor, toPx } from './values.js'

export type UtilityKind = 'color' | 'text' | 'spacing' | 'radius'

const UTILITIES: Record<string, { kind: UtilityKind; prop: string }> = {}
const def = (kind: UtilityKind, map: Record<string, string>) => { for (const [u, prop] of Object.entries(map)) UTILITIES[u] = { kind, prop } }
def('color', {
  bg: 'background-color', border: 'border-color', outline: 'outline-color', ring: 'outline-color', divide: 'border-color',
  fill: 'fill', stroke: 'stroke', decoration: 'text-decoration-color', accent: 'accent-color', caret: 'caret-color',
  ...Object.fromEntries(['x', 'y', 't', 'r', 'b', 'l', 's', 'e'].map((s) => [`border-${s}`, 'border-color'])),
})
def('text', { text: 'color' })
const SIDES: Record<string, string> = { '': '', x: '-inline', y: '-block', t: '-top', r: '-right', b: '-bottom', l: '-left', s: '-inline-start', e: '-inline-end' }
for (const [s, suffix] of Object.entries(SIDES)) def('spacing', { ['p' + s]: 'padding' + suffix, ['m' + s]: 'margin' + suffix })
def('spacing', { gap: 'gap', 'gap-x': 'column-gap', 'gap-y': 'row-gap' })
for (const s of ['', 't', 'r', 'b', 'l', 's', 'e', 'tl', 'tr', 'br', 'bl', 'ss', 'se', 'es', 'ee']) def('radius', { ['rounded' + (s && '-' + s)]: 'border-radius' })
const BY_LENGTH = Object.keys(UTILITIES).sort((a, b) => b.length - a.length)

/** Theme namespace of each utility kind, and the kind of token it holds. */
const NAMESPACE: Record<UtilityKind, string> = { color: 'color', text: 'text', spacing: 'spacing', radius: 'radius' }

/** Tailwind's default palette and scales: what a DS that resets a namespace takes away. */
export const DEFAULT_PALETTE = /^(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(50|[1-9]00|950)$|^(black|white)$/
export const DEFAULT_TEXT = /^(xs|sm|base|lg|[2-9]?xl)$/
export const DEFAULT_RADIUS = /^(xs|sm|md|lg|[2-4]?xl)$/
const NUMBER = /^\d+(\.\d+)?$/

export interface ParsedClass extends TailwindOrigin {
  kind: UtilityKind
  prop: string
  negative: boolean
  /** Arbitrary value with `_` turned into spaces (`p-[4px_8px]` -> "4px 8px"), or `var(--x)` for `bg-(--x)`. */
  arbitrary?: string
  /** Theme key: `bg-brand/50` -> "brand". */
  name?: string
}

/** Index of the last `ch` outside brackets and parentheses, -1 if none. */
function lastTopLevel(s: string, ch: string): number {
  let depth = 0, at = -1
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === ch && depth === 0) at = i
  }
  return at
}

/** Parses one class into utility + value, or null when it is not a utility DS Guard checks. */
export function parseClass(cls: string): ParsedClass | null {
  const cut = lastTopLevel(cls, ':')
  let before = cls.slice(0, cut + 1), base = cls.slice(cut + 1), after = ''
  if (base.startsWith('!')) { before += '!'; base = base.slice(1) } // v3 important
  if (base.endsWith('!')) { after = '!'; base = base.slice(0, -1) } // v4 important
  const negative = base.startsWith('-')
  if (negative) { before += '-'; base = base.slice(1) }
  const slash = lastTopLevel(base, '/')
  if (slash > 0) { after = base.slice(slash) + after; base = base.slice(0, slash) }

  const util = BY_LENGTH.find((u) => base.startsWith(u + '-'))
  if (!util) return null
  const { kind, prop } = UTILITIES[util]!
  const rest = base.slice(util.length + 1)
  const out: ParsedClass = { cls, util, before, after, kind, prop, negative }
  if (rest.startsWith('[') && rest.endsWith(']')) {
    out.arbitrary = rest.slice(1, -1).replace(/^[a-z-]+:(?!\/)/, '').replace(/(?<!\\)_/g, ' ')
  } else if (/^\(--[\w-]+\)$/.test(rest)) {
    out.arbitrary = `var(${rest.slice(1, -1)})`
  } else if (/^[\w.-]+$/.test(rest)) {
    out.name = rest
  } else return null
  return out
}

/** The style declaration a class stands for, or null when it is not certain. */
export function classToDecl(p: ParsedClass, tokens: TokenIndex): { prop: string; value: string } | null {
  if (p.arbitrary !== undefined) {
    const v = p.arbitrary.trim()
    if (/var\(\s*--/.test(v)) return { prop: p.prop, value: v }
    if (p.kind === 'color' || p.kind === 'text') {
      if (normColor(v)) return { prop: p.prop, value: v }
      if (p.kind === 'text' && toPx(v) !== null) return { prop: 'font-size', value: v }
      return null
    }
    const parts = v.split(/\s+/)
    if (p.kind === 'radius') return parts.length === 1 && toPx(v) !== null ? { prop: p.prop, value: v } : null
    if (!parts.every((x) => x === '0' || toPx(x) !== null)) return null
    return { prop: p.prop, value: p.negative ? parts.map((x) => (x === '0' ? x : '-' + x)).join(' ') : v }
  }
  // Theme utility: only when the variable is a DS token, so a non-Tailwind DS never sees made-up names.
  const name = p.name!
  const has = (v: string) => tokens.byVar.has(v)
  if (p.kind === 'text') {
    if (has(`--text-${name}`)) return { prop: 'font-size', value: `var(--text-${name})` }
    if (has(`--color-${name}`)) return { prop: 'color', value: `var(--color-${name})` }
    return null
  }
  const v = `--${NAMESPACE[p.kind]}-${name}`
  if (has(v)) return { prop: p.prop, value: `var(${v})` }
  if (p.kind === 'spacing' && NUMBER.test(name) && has('--spacing')) return { prop: p.prop, value: `calc(var(--spacing) * ${p.negative ? '-' : ''}${name})` }
  return null
}

/** Adds the declarations of each document's Tailwind classes to its styles. */
export function expandTailwind(docs: UiDocument[], tokens: TokenIndex): UiDocument[] {
  return docs.map((doc) => {
    if (!doc.classes?.length) return doc
    const extra: StyleDecl[] = []
    for (const c of doc.classes) {
      const p = parseClass(c.cls)
      const d = p && classToDecl(p, tokens)
      if (d) extra.push({ ...d, context: c.context, loc: c.loc, tailwind: { cls: p.cls, util: p.util, before: p.before, after: p.after } })
    }
    return extra.length ? { ...doc, styles: [...doc.styles, ...extra] } : doc
  })
}

const KIND_NS: Record<ValueKind, string> = { color: 'color', spacing: 'spacing', radius: 'radius', fontSize: 'text' }

/**
 * The class that uses a token instead: `bg-[#1f2328]` -> `bg-fg-default` when the token is in the DS Tailwind theme,
 * otherwise `bg-[var(--color-fg-default)]` (valid in Tailwind v3 and v4).
 */
export function classForToken(tw: TailwindOrigin, token: Token, kind: ValueKind, inTheme: (v: string) => boolean): string | undefined {
  if (!token.cssVar) return undefined
  const prefix = `--${KIND_NS[kind]}-`
  const value = inTheme(token.cssVar) && token.cssVar.startsWith(prefix) && !token.cssVar.includes('--', 2) ? token.cssVar.slice(prefix.length) : `[var(${token.cssVar})]`
  return tw.before + tw.util + '-' + value + tw.after
}

/** v4 spacing scale: `p-[12px]` with `--spacing: 0.25rem` -> step 3. Steps are whole or half; `exact` false gives the nearest. */
export function spacingStep(px: number, tokens: TokenIndex): { step: number; exact: boolean } | null {
  const base = tokens.byVar.get('--spacing')
  const bpx = base && toPx(base.values[0] ?? '')
  if (!bpx) return null
  const n = Math.abs(px) / bpx
  const step = Math.round(n * 2) / 2
  return { step, exact: Math.abs(step - n) < 1e-6 }
}

/** Reads the custom properties and namespace resets of every @theme block of a CSS file (no execution). */
export function parseTailwindTheme(css: string): TailwindTheme | null {
  const vars = new Set<string>(), resets = new Set<string>()
  let found = false
  for (const m of css.matchAll(/@theme\b[^{;]*\{/g)) {
    found = true
    let depth = 1, i = m.index! + m[0].length
    const start = i
    while (i < css.length && depth) { if (css[i] === '{') depth++; else if (css[i] === '}') depth--; i++ }
    const body = css.slice(start, i - 1).replace(/\/\*[\s\S]*?\*\//g, '')
    for (const r of body.matchAll(/--([\w-]*?)-?\*\s*:\s*initial/g)) resets.add(r[1] || '*')
    for (const v of body.matchAll(/(--[\w-]+)\s*:/g)) vars.add(v[1]!)
  }
  return found ? { vars: [...vars].sort(), resets: [...resets].sort() } : null
}

/** Whether a class uses a value of Tailwind's default theme that the DS theme removed. */
export function offTheme(p: ParsedClass, resets: Set<string>, defined: (v: string) => boolean): string | null {
  if (!p.name) return null
  const closed = (ns: string) => resets.has('*') || resets.has(ns)
  const name = p.name
  if ((p.kind === 'color' || p.kind === 'text') && DEFAULT_PALETTE.test(name)) return closed('color') && !defined(`--color-${name}`) ? 'color' : null
  if (p.kind === 'text' && DEFAULT_TEXT.test(name)) return closed('text') && !defined(`--text-${name}`) ? 'text' : null
  if (p.kind === 'radius' && DEFAULT_RADIUS.test(name)) return closed('radius') && !defined(`--radius-${name}`) ? 'radius' : null
  if (p.kind === 'spacing' && NUMBER.test(name) && name !== '0') return closed('spacing') && !defined('--spacing') && !defined(`--spacing-${name}`) ? 'spacing' : null
  return null
}

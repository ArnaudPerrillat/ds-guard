// Lookup tables over the contract's tokens, used to recognise and suggest tokens.

import type { Contract, Token } from './types.js'
import { normColor, toPx } from './values.js'

export type ValueKind = 'color' | 'spacing' | 'radius' | 'fontSize'

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => (m.get(k) ?? m.set(k, []).get(k)!).push(v)

/** Names that make a dimension token a spacing token. Layout sizes (width, breakpoint…) are excluded. */
const SPACING_NAME = /space|spacing|gap|stack|inset|padding|margin|gutter|base-size|size-\d|^size\./i
const NOT_SPACING = /radius|border|font|line|shadow|breakpoint|width|height|icon|z-?index|duration|opacity|outline/i

export class TokenIndex {
  readonly byVar = new Map<string, Token>()
  /** Custom properties the DS defines anywhere, tokens or not. */
  readonly knownVars = new Set<string>()
  private colors = new Map<string, Token[]>()
  private dims: Record<Exclude<ValueKind, 'color'>, Map<number, Token[]>> = { spacing: new Map(), radius: new Map(), fontSize: new Map() }
  /** First dash-segment of every DS custom property: "--color-fg" -> "color". */
  readonly prefixes = new Set<string>()

  constructor(contract: Contract) {
    for (const pkg of contract.packages) {
      for (const v of pkg.knownVars ?? []) this.knownVars.add(v)
      for (const t of pkg.tokens) {
        if (t.cssVar) {
          this.byVar.set(t.cssVar, t)
          const prefix = t.cssVar.slice(2).split('-')[0]
          if (prefix) this.prefixes.add(prefix)
        }
        for (const v of t.values) {
          if (t.type === 'color') { const hex = normColor(v); if (hex) push(this.colors, hex, t) }
          const px = toPx(v)
          if (px === null) continue
          if (t.type === 'radius') push(this.dims.radius, px, t)
          else if (t.type === 'fontSize') push(this.dims.fontSize, px, t)
          else if (t.type === 'dimension' && SPACING_NAME.test(t.name) && !NOT_SPACING.test(t.name)) push(this.dims.spacing, px, t)
        }
      }
    }
  }

  /** Whether the DS defines a scale for this kind of value. Rules stay silent otherwise. */
  has(kind: ValueKind): boolean {
    return kind === 'color' ? this.colors.size > 0 : this.dims[kind].size > 0
  }

  /** Tokens with exactly this value, best first for the property. */
  exact(kind: ValueKind, value: string, prop: string, context = ''): Token[] {
    const live = (ts: Token[] | undefined) => (ts ?? []).filter((t) => !t.deprecated)
    if (kind === 'color') {
      const hex = normColor(value)
      const found = hex ? live(this.colors.get(hex)) : []
      return rankColor(found, prop)
    }
    const px = toPx(value)
    if (px === null) return []
    const found = live(this.dims[kind].get(Math.abs(px)))
    if (kind === 'radius') return [...found].sort((a, b) => Number(/^(border-?)?radius|^rounded/i.test(b.name)) - Number(/^(border-?)?radius|^rounded/i.test(a.name)))
    if (kind === 'fontSize') return [...found].sort((a, b) => Number(/^(font|text)/i.test(b.name)) - Number(/^(font|text)/i.test(a.name)))
    if (kind !== 'spacing') return found
    // Phase 0: control-* tokens only make sense on control-like selectors.
    const isControl = /btn|button|input|control|toggle|select/i.test(context)
    return found.filter((t) => isControl || !/control/i.test(t.name)).sort((a, b) => spacingRank(a) - spacingRank(b))
  }

  /** Nearest token on the scale, for an approximate hint (never an automatic fix). */
  nearest(kind: Exclude<ValueKind, 'color'>, value: string): { token: Token; px: number } | null {
    const px = toPx(value)
    if (px === null) return null
    let best: { token: Token; px: number } | null = null
    for (const [k, ts] of this.dims[kind]) {
      const t = ts.find((x) => !x.deprecated && !/control/i.test(x.name))
      if (t && (!best || Math.abs(k - Math.abs(px)) < Math.abs(best.px - Math.abs(px)))) best = { token: t, px: k }
    }
    return best
  }
}

const spacingRank = (t: Token) => (/space|spacing|gap|stack|inset/i.test(t.name) ? 0 : 1)

function rankColor(ts: Token[], prop: string): Token[] {
  const want = prop === 'color' || prop === 'fill' || prop === 'caret-color' ? /fg|text|foreground|icon/i
    : prop.startsWith('background') ? /bg|background|surface|canvas/i
    : prop.startsWith('border') || prop.startsWith('outline') ? /border|outline|stroke/i
    : null
  if (!want) return ts
  return [...ts].sort((a, b) => Number(want.test(b.name)) - Number(want.test(a.name)) || Number(/base|palette|scale/i.test(a.name)) - Number(/base|palette|scale/i.test(b.name)))
}

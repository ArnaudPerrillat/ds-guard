// The rule set. Few rules, high confidence (ADR 0008): each has a stable id, a default severity
// and, where possible, a fix. A rule only fires when the contract gives it something to compare to.

import type { UiDocument, UiElement } from './model.js'
import type { ResolvedElement } from './resolve.js'
import { dsPackageOf } from './resolve.js'
import { TokenIndex, type ValueKind } from './tokens.js'
import type { Contract, Finding, Severity, Token } from './types.js'
import { classForToken, offTheme, parseClass, spacingStep } from './tailwind.js'
import { COLOR_LITERAL, PROP_GROUPS, isIndirect, normColor, toPx } from './values.js'

export type RuleCategory = 'tokens' | 'components' | 'a11y' | 'exceptions'

export interface RuleMeta {
  id: string
  severity: Severity
  category: RuleCategory
  description: string
}

export interface RuleContext {
  docs: UiDocument[]
  contract: Contract
  tokens: TokenIndex
  elements: ResolvedElement[]
}

export type Report = (f: Omit<Finding, 'ruleId' | 'severity'>) => void

export interface Rule extends RuleMeta {
  check(ctx: RuleContext, report: Report): void
}

const tokenRef = (t: Token) => (t.cssVar ? `var(${t.cssVar})` : t.name)

// ---------- Hard-coded values ----------

function hardcoded(id: string, kind: ValueKind, group: RegExp, label: string): Rule {
  return {
    id, severity: 'warning', category: 'tokens',
    description: `Hard-coded ${label} where the design system has a token scale.`,
    check({ docs, tokens, contract }, report) {
      if (!tokens.has(kind)) return
      const themeVars = new Set(contract.packages.flatMap((p) => p.tailwind?.vars ?? []))
      for (const doc of docs) for (const d of doc.styles) {
        if (!group.test(d.prop) || isIndirect(d.value)) continue
        const value = d.value.replace(/!important/i, '').trim()
        const parts = kind === 'color' ? [...value.matchAll(COLOR_LITERAL)].map((m) => m[0]).filter((c) => normColor(c)) : value.split(/\s+/)
        for (const part of parts) {
          if (kind !== 'color') {
            const px = toPx(part)
            if (px === null || px === 0) continue
            if (kind === 'spacing' && Math.abs(px) <= 1) continue // phase 0 false-positive class #2: optical/border offsets
          }
          const tw = d.tailwind
          const where = tw ? tw.cls : d.prop
          const step = tw && kind === 'spacing' ? spacingStep(toPx(part)!, tokens) : null
          if (tw && step) {
            const cls = tw.before + tw.util + '-' + step.step + tw.after
            report(step.exact
              ? { loc: d.loc, subject: tw.cls, message: `Hard-coded spacing \`${part}\` in \`${tw.cls}\`: use \`${cls}\` from the theme spacing scale.`, fix: { description: `Replace with ${cls}`, replacement: value === part ? cls : undefined } }
              : { loc: d.loc, subject: tw.cls, message: `Hard-coded spacing \`${part}\` in \`${tw.cls}\` is off the theme spacing scale; nearest is \`${cls}\`. Use the scale or declare an exception.`, fix: { description: `Closest step: ${cls} (changes the value)` } })
            continue
          }
          const exact = tokens.exact(kind, part, d.prop, d.context)
          const best = exact[0]
          if (best) {
            const cls = tw && classForToken(tw, best, kind, (v) => themeVars.has(v))
            const others = exact.length > 1 ? ` (or ${exact.slice(1, 3).map((t) => '`' + t.name + '`').join(', ')})` : ''
            report({
              loc: d.loc, subject: tw ? tw.cls : part,
              message: cls
                ? `Hard-coded ${label} \`${part}\` in \`${where}\`: use \`${cls}\` (token \`${best.name}\`${others}).`
                : `Hard-coded ${label} \`${part}\` in \`${where}\`: use token \`${best.name}\`${others}.`,
              fix: cls
                ? { description: `Replace with ${cls}`, replacement: value === part ? cls : undefined }
                : { description: `Replace with ${tokenRef(best)}`, replacement: value === part && doc.kind === 'css' ? tokenRef(best) : undefined },
            })
            continue
          }
          const near = kind === 'color' ? null : tokens.nearest(kind, part)
          report({
            loc: d.loc, subject: tw ? tw.cls : part,
            message: `Hard-coded ${label} \`${part}\` in \`${where}\` matches no token${near ? `; nearest is \`${near.token.name}\` (${near.px}px)` : ''}. Use a token or declare an exception.`,
            fix: near ? { description: `Closest token: ${tokenRef(near.token)} (changes the value)` } : undefined,
          })
        }
      }
    },
  }
}

// ---------- Tailwind v4 theme (ADR 0018) ----------

const NS_LABEL: Record<string, string> = { color: 'colour', text: 'font size', radius: 'radius', spacing: 'spacing' }

const noOffThemeUtility: Rule = {
  id: 'no-off-theme-utility', severity: 'warning', category: 'tokens',
  description: "A Tailwind utility from the default theme that the design system's @theme removes.",
  check({ docs, contract, tokens }, report) {
    const themes = contract.packages.flatMap((p) => (p.tailwind ? [p.tailwind] : []))
    const resets = new Set([...themes.flatMap((t) => t.resets), ...docs.flatMap((d) => d.themeResets ?? [])])
    if (!resets.size) return
    const vars = new Set([...themes.flatMap((t) => t.vars), ...tokens.byVar.keys(), ...tokens.knownVars, ...docs.flatMap((d) => d.definedVars)])
    for (const doc of docs) for (const c of doc.classes ?? []) {
      const p = parseClass(c.cls)
      const ns = p && offTheme(p, resets, (v) => vars.has(v))
      if (!p || !ns) continue
      const pre = `--${ns}-`
      const options = [...vars].filter((v) => v.startsWith(pre) && !v.includes('--', 2)).slice(0, 3).map((v) => '`' + p.before + p.util + '-' + v.slice(pre.length) + p.after + '`')
      report({
        loc: c.loc, subject: c.cls,
        message: `\`${c.cls}\` uses Tailwind's default ${NS_LABEL[ns]} scale, which the design system theme removes: it generates no style.${options.length ? ` Use the theme, e.g. ${options.join(', ')}.` : ''}`,
      })
    }
  },
}

const VAR_USE = /var\(\s*(--[\w-]+)/g

const noUnknownToken: Rule = {
  id: 'no-unknown-token', severity: 'warning', category: 'tokens',
  description: 'A CSS variable that looks like a DS token does not exist in the installed DS version.',
  check({ docs, tokens }, report) {
    if (!tokens.byVar.size) return
    const local = new Set(docs.flatMap((d) => d.definedVars))
    for (const doc of docs) for (const d of doc.styles) for (const m of d.value.matchAll(VAR_USE)) {
      const v = m[1]!
      if (tokens.byVar.has(v) || tokens.knownVars.has(v) || local.has(v)) continue
      // Names built at runtime (`--fg-${tone}`, `--x-#{$y}`) cannot be checked statically.
      if (v.endsWith('-') || /^[$#{]/.test(d.value.slice(m.index! + m[0].length))) continue
      const prefix = v.slice(2).split('-')[0]!
      if (!tokens.prefixes.has(prefix)) continue
      report({ loc: d.loc, subject: v, message: `\`${v}\` is not a token of the installed design system (it may have been renamed or removed).` })
    }
  },
}

const noDeprecatedToken: Rule = {
  id: 'no-deprecated-token', severity: 'warning', category: 'tokens',
  description: 'Use of a token marked deprecated in the installed DS version.',
  check({ docs, tokens }, report) {
    for (const doc of docs) for (const d of doc.styles) for (const m of d.value.matchAll(VAR_USE)) {
      const t = tokens.byVar.get(m[1]!)
      if (t?.deprecated) report({ loc: d.loc, subject: m[1]!, message: `Token \`${t.name}\` is deprecated: ${t.deprecated}` })
    }
  },
}

// ---------- Components ----------

const direct = (elements: ResolvedElement[]) => elements.filter((e) => e.origin.kind === 'ds' && e.origin.via.length === 0)

function component(ctx: RuleContext, e: ResolvedElement) {
  if (e.origin.kind !== 'ds') return undefined
  const o = e.origin
  return ctx.contract.packages.find((p) => p.name === o.pkg)?.components[o.component]
}

const noDeprecatedComponent: Rule = {
  id: 'no-deprecated-component', severity: 'warning', category: 'components',
  description: 'Use of a component marked @deprecated in the installed DS version.',
  check(ctx, report) {
    for (const e of direct(ctx.elements)) {
      const c = component(ctx, e)
      if (c?.deprecated !== undefined && !(e.origin.kind === 'ds' && e.origin.member)) report({ loc: e.el.loc, subject: e.el.tag, message: `\`${c.name}\` is deprecated${c.deprecated ? ': ' + c.deprecated : '.'}` })
    }
  },
}

const noDeprecatedProp: Rule = {
  id: 'no-deprecated-prop', severity: 'warning', category: 'components',
  description: 'Use of a prop marked @deprecated in the installed DS version.',
  check(ctx, report) {
    for (const e of direct(ctx.elements)) {
      if (e.origin.kind === 'ds' && e.origin.member) continue
      const c = component(ctx, e)
      for (const a of e.el.attrs) {
        const p = c?.props[a.name]
        if (p?.deprecated !== undefined) report({ loc: a.loc, subject: a.name, message: `Prop \`${a.name}\` of \`${c!.name}\` is deprecated${p.deprecated ? ': ' + p.deprecated : '.'}` })
      }
    }
  },
}

const noInvalidPropValue: Rule = {
  id: 'no-invalid-prop-value', severity: 'warning', category: 'components',
  description: 'A literal prop value outside the values the DS component accepts.',
  check(ctx, report) {
    for (const e of direct(ctx.elements)) {
      if (e.origin.kind === 'ds' && e.origin.member) continue
      const c = component(ctx, e)
      for (const a of e.el.attrs) {
        const allowed = c?.props[a.name]?.values
        if (!allowed || a.value.kind !== 'string' || allowed.includes(a.value.value)) continue
        const close = allowed.find((v) => v.toLowerCase() === (a.value as { value: string }).value.toLowerCase())
        report({
          loc: a.loc, subject: `${a.name}="${a.value.value}"`,
          message: `\`${c!.name}\` does not accept ${a.name}="${a.value.value}". Allowed: ${allowed.map((v) => '`' + v + '`').join(', ')}.`,
          fix: close ? { description: `Use ${a.name}="${close}"`, replacement: close } : undefined,
        })
      }
    }
  },
}

const noDeepImport: Rule = {
  id: 'no-deep-import', severity: 'warning', category: 'components',
  description: 'Import from a DS internal path instead of a public entry point.',
  check({ docs, contract }, report) {
    for (const doc of docs) for (const imp of doc.imports) {
      const pkg = dsPackageOf(imp.source, contract)
      if (!pkg || pkg.entryPoints.includes(imp.source) || /\.(css|scss)$/.test(imp.source)) continue
      report({ loc: imp.loc, subject: imp.source, message: `\`${imp.source}\` is not a public entry point of ${pkg.name}@${pkg.version}. Use ${pkg.entryPoints.map((e) => '`' + e + '`').join(' or ')}.` })
    }
  },
}

/** Native element -> DS component names that replace it (first match in the contract wins). */
const EQUIVALENTS: Record<string, string[]> = {
  button: ['Button'], a: ['Link'], input: ['TextInput', 'Input'], select: ['Select'], textarea: ['Textarea', 'TextArea'],
  h1: ['Heading'], h2: ['Heading'], h3: ['Heading'], h4: ['Heading'], h5: ['Heading'], h6: ['Heading'],
  table: ['Table', 'DataTable'], dialog: ['Dialog', 'Modal'],
}

export function dsEquivalent(tag: string, contract: Contract): string | undefined {
  for (const name of EQUIVALENTS[tag] ?? []) for (const p of contract.packages) if (p.components[name]) return name
  return undefined
}

const preferDsComponent: Rule = {
  id: 'prefer-ds-component', severity: 'info', category: 'components',
  description: 'A native element where the DS has a component for it.',
  check({ elements, contract }, report) {
    for (const e of elements) {
      if (e.origin.kind !== 'intrinsic') continue
      const eq = dsEquivalent(e.el.tag, contract)
      if (eq) report({ loc: e.el.loc, subject: `<${e.el.tag}>`, message: `Native \`<${e.el.tag}>\`: the design system provides \`${eq}\`.` })
    }
  },
}

// ---------- Accessibility (blocking by default, ADR 0010) ----------

const attr = (el: UiElement, name: string) => el.attrs.find((a) => a.name === name)
const hasName = (el: UiElement) => el.text.length > 0 || el.hasDynamicChildren || el.hasSpread || ['aria-label', 'aria-labelledby', 'title'].some((n) => attr(el, n))

const a11yAccessibleName: Rule = {
  id: 'a11y-accessible-name', severity: 'error', category: 'a11y',
  description: 'A button or link with no accessible name (no text, aria-label, aria-labelledby or title).',
  check({ elements }, report) {
    for (const e of elements) {
      if (e.origin.kind !== 'intrinsic' || !(e.el.tag === 'button' || (e.el.tag === 'a' && attr(e.el, 'href')))) continue
      if (!hasName(e.el)) report({ loc: e.el.loc, subject: `<${e.el.tag}>`, message: `\`<${e.el.tag}>\` has no accessible name: add visible text or \`aria-label\`.` })
    }
  },
}

const a11yImgAlt: Rule = {
  id: 'a11y-img-alt', severity: 'error', category: 'a11y',
  description: 'An image without an alt attribute.',
  check({ elements }, report) {
    for (const e of elements) {
      if (e.origin.kind !== 'intrinsic' || e.el.tag !== 'img' || e.el.hasSpread || attr(e.el, 'alt')) continue
      report({ loc: e.el.loc, subject: '<img>', message: '`<img>` has no `alt`: describe the image, or use `alt=""` if it is decorative.', fix: { description: 'Add alt="" if the image is decorative' } })
    }
  },
}

const a11yNoPositiveTabindex: Rule = {
  id: 'a11y-no-positive-tabindex', severity: 'error', category: 'a11y',
  description: 'A positive tabIndex, which breaks the natural focus order.',
  check({ elements }, report) {
    for (const e of elements) {
      const t = attr(e.el, 'tabIndex') ?? attr(e.el, 'tabindex')
      const n = t?.value.kind === 'number' ? t.value.value : t?.value.kind === 'string' ? Number(t.value.value) : NaN
      if (t && n > 0) report({ loc: t.loc, subject: `tabIndex=${n}`, message: `\`tabIndex=${n}\` overrides the natural focus order: use 0 or -1.`, fix: { description: 'Use tabIndex={0}', replacement: '0' } })
    }
  },
}

export const RULES: Rule[] = [
  hardcoded('no-hardcoded-color', 'color', PROP_GROUPS.color, 'colour'),
  hardcoded('no-hardcoded-spacing', 'spacing', PROP_GROUPS.spacing, 'spacing'),
  hardcoded('no-hardcoded-radius', 'radius', PROP_GROUPS.radius, 'radius'),
  hardcoded('no-hardcoded-font-size', 'fontSize', PROP_GROUPS.fontSize, 'font size'),
  noOffThemeUtility,
  noUnknownToken,
  noDeprecatedToken,
  noDeprecatedComponent,
  noDeprecatedProp,
  noInvalidPropValue,
  noDeepImport,
  preferDsComponent,
  a11yAccessibleName,
  a11yImgAlt,
  a11yNoPositiveTabindex,
]

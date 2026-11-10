import { describe, expect, it } from 'vitest'
import { computeMetrics, parseClass, parseTailwindTheme, runRules, toDocuments, type Contract, type Finding } from '../src/index.js'
import { vitals } from './helpers.js'

/** A Tailwind v4 DS: tokens come from its @theme, which resets the default palette and radii. */
const tw: Contract = {
  schemaVersion: 1,
  packages: [{
    name: '@acme/ui', version: '1.0.0', entryPoints: ['@acme/ui'], components: {},
    tokens: [
      { name: 'color-brand', cssVar: '--color-brand', values: ['#5b6472'], type: 'color' },
      { name: 'color-surface', cssVar: '--color-surface', values: ['#ffffff'], type: 'color' },
      { name: 'color-legacy', cssVar: '--color-legacy', values: ['#0a5f66'], type: 'color', deprecated: 'Use color-brand' },
      { name: 'spacing', cssVar: '--spacing', values: ['0.25rem'], type: 'dimension' },
      { name: 'radius-card', cssVar: '--radius-card', values: ['8px'], type: 'radius' },
      { name: 'text-body', cssVar: '--text-body', values: ['0.875rem'], type: 'fontSize' },
    ],
    tailwind: { vars: ['--color-brand', '--color-surface', '--color-legacy', '--spacing', '--radius-card', '--text-body'], resets: ['color', 'radius'] },
  }],
}

const run = (files: Record<string, string>, contract = tw, only?: string[]) =>
  runRules(toDocuments(Object.entries(files).map(([path, content]) => ({ path, content }))).docs, contract, {}, { only })
const ids = (fs: Finding[]) => fs.map((f) => `${f.ruleId}:${f.subject}`)

describe('parseClass', () => {
  it('splits variants, important, negative and opacity modifiers', () => {
    expect(parseClass('md:hover:bg-[#5b6472]/50')).toMatchObject({ util: 'bg', before: 'md:hover:', after: '/50', arbitrary: '#5b6472' })
    expect(parseClass('-mt-[4px]!')).toMatchObject({ util: 'mt', before: '-', after: '!', negative: true, arbitrary: '4px' })
    expect(parseClass('px-[4px_8px]')).toMatchObject({ util: 'px', arbitrary: '4px 8px' })
    expect(parseClass('bg-(--color-brand)')).toMatchObject({ util: 'bg', arbitrary: 'var(--color-brand)' })
    expect(parseClass('[&>svg]:text-sm')).toMatchObject({ util: 'text', name: 'sm', before: '[&>svg]:' })
    expect(parseClass('flex')).toBeNull()
  })
})

describe('arbitrary values', () => {
  it('reports them with the same rule ids and suggests the theme utility', () => {
    const { findings } = run({ 'a.tsx': `export const A = () => <div className="bg-[#5b6472] p-[12px] rounded-[8px] text-[0.875rem] hover:text-[#ffffff]/80 m-[13px]" />` })
    expect(ids(findings)).toEqual([
      'no-hardcoded-color:bg-[#5b6472]', 'no-hardcoded-spacing:p-[12px]', 'no-hardcoded-radius:rounded-[8px]',
      'no-hardcoded-font-size:text-[0.875rem]', 'no-hardcoded-color:hover:text-[#ffffff]/80', 'no-hardcoded-spacing:m-[13px]',
    ])
    const [color, spacing, radius, size, hover, odd] = findings
    expect(color!.fix?.replacement).toBe('bg-brand')
    expect(spacing!.fix?.replacement).toBe('p-3')
    expect(radius!.fix?.replacement).toBe('rounded-card')
    expect(size!.fix?.replacement).toBe('text-body')
    expect(hover!.fix?.replacement).toBe('hover:text-surface/80')
    expect(odd!.message).toContain('nearest is `m-3.5`')
    expect(color!.loc).toMatchObject({ line: 1, column: 40 })
  })

  it('reports @apply in CSS', () => {
    expect(ids(run({ 'a.css': '.card {\n  @apply flex bg-[#5b6472] p-4;\n}' }).findings)).toEqual(['no-hardcoded-color:bg-[#5b6472]'])
  })

  it('ignores values it cannot read with certainty', () => {
    const src = `export const A = () => <div className="bg-[url(/img/blue.png)] w-[13px] grid-cols-[1fr_2fr] border-[3px] text-[length:var(--x)] p-[calc(1rem+2px)] m-[1px]" />`
    expect(run({ 'a.tsx': src }).findings).toEqual([])
  })

  it('suggests a var() class when the token lives outside the Tailwind namespace', () => {
    const f = run({ 'a.tsx': `export const A = () => <p className="text-[#1f2328]" />` }, vitals).findings
    expect(f[0]!.fix?.replacement).toBe('text-[var(--color-fg-default)]')
  })
})

describe('class helpers', () => {
  it('reads string literals in cn/clsx/classnames and cva, ignores computed strings', () => {
    const src = `import { cva } from 'class-variance-authority'
const button = cva('inline-flex p-[12px]', {
  variants: { intent: { primary: 'bg-[#5b6472]', ghost: ['bg-transparent', 'text-[#ffffff]'] } },
  compoundVariants: [{ intent: 'primary', class: 'rounded-[8px]' }],
  defaultVariants: { intent: 'primary' },
})
export const A = ({ tone, on }) => <div className={cn('m-[13px]', on && 'gap-[8px]', { 'bg-[#ffffff]': on }, \`bg-[#5b6472] bg-\${tone}-500 p-\${tone}\`, clsx(on ? 'text-[0.875rem]' : null), tone)} />
const x = classnames('rounded-[8px] ' + tone)`
    expect(ids(run({ 'a.tsx': src }).findings)).toEqual([
      'no-hardcoded-spacing:p-[12px]', 'no-hardcoded-color:bg-[#5b6472]', 'no-hardcoded-color:text-[#ffffff]', 'no-hardcoded-radius:rounded-[8px]',
      'no-hardcoded-spacing:m-[13px]', 'no-hardcoded-spacing:gap-[8px]', 'no-hardcoded-color:bg-[#ffffff]', 'no-hardcoded-color:bg-[#5b6472]', 'no-hardcoded-font-size:text-[0.875rem]',
      'no-hardcoded-radius:rounded-[8px]',
    ])
  })
})

describe('no-off-theme-utility', () => {
  it('flags default-palette and default-radius utilities the DS theme resets', () => {
    const src = `export const A = () => <div className="bg-blue-500 hover:text-white rounded-lg text-sm p-4 bg-brand text-body bg-cover text-center rounded-full rounded" />`
    const f = run({ 'a.tsx': src }, tw, ['no-off-theme-utility']).findings
    expect(ids(f)).toEqual(['no-off-theme-utility:bg-blue-500', 'no-off-theme-utility:hover:text-white', 'no-off-theme-utility:rounded-lg'])
    expect(f[0]!.message).toContain('`bg-brand`')
  })

  it('accepts colours the app adds to its own theme, and stays silent without a reset', () => {
    const files = { 'theme.css': '@theme { --color-blue-500: #3b82f6; }', 'a.tsx': `export const A = () => <div className="bg-blue-500 bg-red-500" />` }
    expect(ids(run(files, tw, ['no-off-theme-utility']).findings)).toEqual(['no-off-theme-utility:bg-red-500'])
    expect(run(files, vitals, ['no-off-theme-utility']).findings).toEqual([])
  })

  it('honours a reset declared in the app CSS', () => {
    const files = { 'app.css': '@import "tailwindcss";\n@theme { --color-*: initial; --color-primary: var(--color-fg-default); }', 'a.tsx': `export const A = () => <div className="bg-slate-100 bg-primary" />` }
    expect(ids(run(files, vitals, ['no-off-theme-utility']).findings)).toEqual(['no-off-theme-utility:bg-slate-100'])
  })
})

describe('theme utilities', () => {
  it('count as DS usages and carry deprecations', () => {
    const { findings, docs, elements } = run({ 'a.tsx': `export const A = () => <div className="bg-brand p-4 text-body bg-legacy bg-[#0a5f66]" />` })
    expect(ids(findings)).toEqual(['no-deprecated-token:--color-legacy', 'no-hardcoded-color:bg-[#0a5f66]'])
    const m = computeMetrics(docs, elements, findings, tw)
    expect(m.styles).toEqual({ ds: 4, excepted: 0, unexplained: 1 })
  })
})

describe('parseTailwindTheme', () => {
  it('reads vars and namespace resets from @theme blocks only', () => {
    const css = ':root { --x: 1px }\n@theme inline {\n  --*: initial;\n  --color-*: initial; /* reset */\n  --color-brand: #5b6472;\n  --spacing: 0.25rem;\n}'
    expect(parseTailwindTheme(css)).toEqual({ vars: ['--color-brand', '--spacing'], resets: ['*', 'color'] })
    expect(parseTailwindTheme(':root { --x: 1px }')).toBeNull()
  })
})

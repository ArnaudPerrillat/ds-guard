import { describe, expect, it } from 'vitest'
import { runRules, toDocuments, type Finding } from '../src/index.js'
import { vitals } from './helpers.js'

const run = (files: Record<string, string>, only?: string[]) =>
  runRules(toDocuments(Object.entries(files).map(([path, content]) => ({ path, content }))).docs, vitals, {}, { only }).findings
const ids = (fs: Finding[]) => fs.map((f) => `${f.ruleId}:${f.subject}`)

describe('hard-coded values', () => {
  it('reports literals with the exact token, prefers the semantic name for the property', () => {
    const f = run({ 'a.css': '.x { color: #1F2328; padding: 8px 13px; border-radius: 4px; font-size: 16px; }' })
    expect(ids(f)).toEqual(['no-hardcoded-color:#1F2328', 'no-hardcoded-spacing:8px', 'no-hardcoded-spacing:13px', 'no-hardcoded-radius:4px', 'no-hardcoded-font-size:16px'])
    expect(f[0]!.message).toContain('`color.fg.default`')
    expect(f[0]!.fix?.replacement).toBe('var(--color-fg-default)')
    expect(f[2]!.message).toContain('nearest is `space.4` (16px)')
    expect(f[2]!.fix?.replacement).toBeUndefined()
  })

  it('ignores var() fallbacks, ±1px offsets, zero, variables and computed values (phase 0 false positives)', () => {
    expect(run({ 'a.scss': '.x { color: var(--color-fg-default, #1f2328); margin: -1px 0 1px; padding: $gap; gap: calc(8px + 2px); }' })).toEqual([])
  })

  it('checks style objects in TSX, numbers included', () => {
    expect(ids(run({ 'a.tsx': `export const A = () => <div style={{ padding: 8, backgroundColor: 'white' }} />` }))).toEqual(['no-hardcoded-spacing:8px', 'no-hardcoded-color:white'])
  })
})

describe('tokens', () => {
  it('flags unknown DS-looking variables but not local ones, and deprecated tokens', () => {
    const f = run({ 'a.css': ':root { --space-local: 2px }\n.x { padding: var(--space-3); margin: var(--space-local); color: var(--brand-x); background: var(--color-brand-legacy); }' }, ['no-unknown-token', 'no-deprecated-token'])
    expect(ids(f)).toEqual(['no-unknown-token:--space-3', 'no-deprecated-token:--color-brand-legacy'])
  })
})

describe('components', () => {
  const page = `import { Button, Box, Card } from '@vitals/ui'
import { Thing } from '@vitals/ui/dist/thing'
export function Page() {
  return <Box><Button variant="primay" destructive /><Button variant={v} /><Card.Header /><button>Save</button></Box>
}`
  it('deprecated components and props, invalid literal values, deep imports, native equivalents', () => {
    expect(ids(run({ 'Page.tsx': page }))).toEqual([
      'no-deep-import:@vitals/ui/dist/thing',
      'no-deprecated-component:Box',
      'no-invalid-prop-value:variant="primay"',
      'no-deprecated-prop:destructive',
      'prefer-ds-component:<button>',
    ])
  })
  it('does not check props through in-house wrappers', () => {
    const f = run({ 'W.tsx': `import { Button } from '@vitals/ui'\nexport const W = (p) => <Button {...p} />`, 'P.tsx': `import { W } from './W'\nexport const P = () => <W variant="custom" />` })
    expect(f).toEqual([])
  })
})

describe('accessibility', () => {
  it('accessible names, img alt, positive tabindex', () => {
    const f = run({ 'a.tsx': `export const A = () => <div tabIndex={2}><button aria-label="Close" /><button><Icon /></button><button /><a href="/x"></a><img src="x" /><img src="y" alt="" /></div>` }, ['a11y-accessible-name', 'a11y-img-alt', 'a11y-no-positive-tabindex'])
    expect(ids(f)).toEqual(['a11y-no-positive-tabindex:tabIndex=2', 'a11y-accessible-name:<button>', 'a11y-accessible-name:<a>', 'a11y-img-alt:<img>'])
    expect(f.every((x) => x.severity === 'error')).toBe(true)
  })
})

describe('no-unknown-token guards', () => {
  it('skips runtime-built names and variables the DS defines outside configured token files', () => {
    const contract = { ...vitals, packages: [{ ...vitals.packages[0]!, knownVars: ['--space-weight-x'] }] }
    const docs = toDocuments([{ path: 'a.tsx', content: 'export const A = () => <div style={{ color: `var(--color-${tone})`, padding: "var(--space-weight-x)" }} />' }]).docs
    expect(runRules(docs, contract, {}, { only: ['no-unknown-token'] }).findings).toEqual([])
  })
})

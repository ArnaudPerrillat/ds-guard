import { describe, expect, it } from 'vitest'
import { parseExceptions, scan, globToRegExp } from '../src/index.js'
import { vitals } from './helpers.js'

const registry = `exceptions:
  - id: EXC-1
    rules: [no-hardcoded-spacing]
    reason: Hero uses an off-scale gap validated in design review.
    owner: "@care-web"
    expires: 2027-03-31
  - id: EXC-OLD
    rules: [no-hardcoded-color]
    reason: Legacy brand colour.
    owner: "@care-web"
    expires: 2026-01-01
  - id: EXC-LEGACY
    rules: [no-hardcoded-spacing]
    reason: Legacy module, rewritten in Q2.
    owner: "@billing"
    expires: 2027-06-30
    files: ["src/legacy/**"]
  - id: BROKEN
    rules: [no-hardcoded-spacing]
`
const now = new Date('2026-11-09')
const run = (files: Record<string, string>, withInvalid = false) => scan({ files: Object.entries(files).map(([path, content]) => ({ path, content })), contract: vitals, exceptions: { path: 'ds-exceptions.yml', content: registry }, now }).findings.filter((f) => withInvalid || f.ruleId !== 'exception-invalid')

describe('exception registry', () => {
  it('parses entries and reports incomplete ones', () => {
    const r = parseExceptions(registry)
    expect(r.entries.map((e) => e.id)).toEqual(['EXC-1', 'EXC-OLD', 'EXC-LEGACY'])
    expect(r.problems).toEqual([{ message: 'Exception BROKEN is missing: reason, owner, expires.', line: 18 }])
  })

  it('globs', () => {
    expect(globToRegExp('src/legacy/**').test('src/legacy/a/b.tsx')).toBe(true)
    expect(globToRegExp('src/**/*.css').test('src/a.css')).toBe(true)
    expect(globToRegExp('src/*.css').test('src/a/b.css')).toBe(false)
    expect(globToRegExp('**/*.{ts,tsx}').test('a/b.tsx')).toBe(true)
  })
})

describe('applying exceptions', () => {
  it('annotation covers its line and the next, only for the rules it declares', () => {
    const f = run({ 'src/a.css': '.hero {\n  /* ds-exception: EXC-1 */\n  padding: 13px;\n  color: #1f2328;\n}' })
    expect(f.map((x) => [x.ruleId, x.exception?.id])).toEqual([['no-hardcoded-spacing', 'EXC-1'], ['no-hardcoded-color', undefined]])
  })

  it('expired exceptions re-open findings and are reported once', () => {
    const f = run({ 'src/a.tsx': `export const A = () => (\n  // ds-exception: EXC-OLD\n  <div style={{ color: '#1f2328' }} />\n)` })
    expect(f.map((x) => [x.ruleId, x.exception?.id])).toEqual([['no-hardcoded-color', undefined], ['exception-expired', undefined]])
  })

  it('file-scoped exceptions, unknown and unused annotations, invalid entries', () => {
    const f = run({ 'src/legacy/b.css': '.x { padding: 13px }', 'src/c.css': '/* ds-exception: NOPE */\n.y { margin: 0 }\n/* ds-exception: EXC-1 */\n.z { margin: 0 }' }, true)
    expect(f.map((x) => `${x.ruleId}:${x.exception?.id ?? x.subject}`)).toEqual([
      'no-hardcoded-spacing:EXC-LEGACY', 'exception-unknown:NOPE', 'exception-unused:EXC-1', 'exception-invalid:ds-exceptions.yml',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { addException, closeException, exceptionsOverview, nextExceptionId, parseExceptions, renderReviewIssue, renewException, RegistryEditError, type Finding } from '../src/index.js'

const now = new Date('2026-11-10')
const text = `# Intentional exceptions.
exceptions:
  # Validated in design review on 2026-10-02.
  - id: EXC-001
    rules: [no-hardcoded-spacing]
    reason: Hero uses an off-scale gap.
    owner: "@care-web"
    expires: 2027-03-31 # quarter end

  - id: EXC-002
    rules: [no-hardcoded-spacing, no-hardcoded-color]
    reason: Legacy billing module.
    owner: "@acme/billing"
    expires: 2026-11-20
    files: ["src/legacy/**"]

  - id: EXC-009
    rules: [prefer-ds-component]
    reason: Data table, no DS equivalent yet.
    owner: "@jdoe"
    expires: 2026-11-01
`
const finding = (ruleId: string, id: string, subject: string): Finding => ({ ruleId, severity: 'warning', message: '', loc: { file: 'a.tsx', line: 1, column: 1 }, subject, exception: { id, owner: '', expires: '' } })
const excepted = [finding('no-hardcoded-spacing', 'EXC-001', '185px'), finding('no-hardcoded-spacing', 'EXC-002', '13px'), finding('no-hardcoded-spacing', 'EXC-002', '13px'), finding('no-hardcoded-color', 'EXC-002', '#123')]

describe('exceptions overview', () => {
  const o = exceptionsOverview(parseExceptions(text).entries, excepted, now, 30)

  it('sorts by expiry with state, days left and covered findings', () => {
    expect(o.items.map((i) => [i.id, i.state, i.daysLeft, i.covered])).toEqual([['EXC-009', 'expired', -9, 0], ['EXC-002', 'expiring', 10, 3], ['EXC-001', 'active', 141, 1]])
    expect(o.counts).toEqual({ active: 2, expiring: 1, expired: 1 })
  })

  it('groups similar exceptions by rule', () => {
    expect(o.groups).toEqual([{ rule: 'no-hardcoded-spacing', exceptions: ['EXC-002', 'EXC-001'], owners: ['@acme/billing', '@care-web'], covered: 3, subjects: [{ subject: '13px', count: 2 }, { subject: '185px', count: 1 }] }])
  })

  it('renders the review issue: due exceptions, user owners assigned, teams mentioned', () => {
    const issue = renderReviewIssue(exceptionsOverview(parseExceptions(text).entries, excepted, now, 14))
    expect(issue.due).toBe(2)
    expect(issue.assignees).toEqual(['jdoe'])
    expect(issue.body).toContain('`EXC-002` | @acme/billing | 2026-11-20 (in 10 days) | 3 |')
    expect(issue.body).toContain('**expired** 2026-11-01 (9 days ago) | count again')
    expect(issue.body).not.toContain('EXC-001')
    expect(renderReviewIssue(exceptionsOverview([], [], now, 14)).due).toBe(0)
  })
})

describe('editing ds-exceptions.yml', () => {
  it('suggests the next id', () => {
    expect(nextExceptionId(parseExceptions(text).entries)).toBe('EXC-010')
    expect(nextExceptionId([])).toBe('EXC-001')
  })

  it('renews in place, keeping comments and order', () => {
    const next = renewException(text, 'EXC-002', '2027-02-28', { now })
    expect(next).toBe(text.replace('expires: 2026-11-20', 'expires: 2027-02-28'))
    expect(() => renewException(text, 'EXC-002', '2026-01-01', { now })).toThrow(/in the past/)
    expect(() => renewException(text, 'NOPE', '2027-01-01', { now })).toThrow(RegistryEditError)
    expect(() => renewException(text, 'EXC-001', '2027-02-30', { now })).toThrow(/must be a date/)
  })

  it('closes an exception, keeping the others intact', () => {
    const next = closeException(text, 'EXC-002')
    expect(parseExceptions(next).entries.map((e) => e.id)).toEqual(['EXC-001', 'EXC-009'])
    expect(next).toContain('# Validated in design review on 2026-10-02.')
    expect(next).toContain('expires: 2027-03-31 # quarter end')
  })

  it('adds an entry, also to the empty registry written by init', () => {
    const entry = { id: 'EXC-010', rules: ['no-hardcoded-radius'], reason: 'Campaign banner: a long reason that should never be folded on several lines by the YAML writer.', owner: '@care-web', expires: '2027-01-31', files: ['src/campaign/**'] }
    const next = addException(text, entry, { now, knownRules: new Set(['no-hardcoded-radius']) })
    expect(next.startsWith(text.trimEnd())).toBe(true)
    expect(parseExceptions(next).entries.at(-1)).toEqual(entry)
    expect(next).toContain('rules: [no-hardcoded-radius]')
    const empty = addException('# Intentional exceptions.\nexceptions: []\n', entry, { now })
    expect(empty).toContain('# Intentional exceptions.\nexceptions:\n  - id: EXC-010')
    expect(parseExceptions(empty).entries).toEqual([entry])
    expect(parseExceptions(addException('', entry, { now })).entries).toEqual([entry])
    expect(() => addException(text, { ...entry, id: 'EXC-001' }, { now })).toThrow(/already exists/)
    expect(() => addException(text, { ...entry, rules: ['nope'] }, { now, knownRules: new Set() })).toThrow(/Unknown rule nope/)
    expect(() => addException(text, { ...entry, owner: '' }, { now })).toThrow(/Missing: owner/)
  })
})

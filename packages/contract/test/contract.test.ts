import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ContractError, extractContract, findLockfile } from '../src/index.js'

const app = path.resolve(__dirname, '../../../fixtures/vitals-app')

describe('extractContract', () => {
  const { contract } = extractContract(app, [{ package: '@vitals/ui', tokens: ['@vitals/tokens/tokens.json'] }])
  const ui = contract.packages[0]!

  it('uses the version resolved in the lockfile and reads every typed entry point', () => {
    expect(ui.version).toBe('3.1.2')
    expect(ui.entryPoints).toEqual(['@vitals/ui', '@vitals/ui/experimental'])
    expect(ui.tokenSources).toEqual([{ spec: '@vitals/tokens/tokens.json', package: '@vitals/tokens', version: '2.0.1' }])
  })

  it('extracts components with props, literal unions, deprecations and sub-components', () => {
    expect(Object.keys(ui.components).sort()).toEqual(['Avatar', 'Badge', 'Box', 'Button', 'Card', 'DataTable', 'Heading', 'IconButton', 'Link', 'Stack', 'Text', 'TextInput'])
    const button = ui.components.Button!
    expect(button.props.variant).toEqual({ required: false, values: ['primary', 'secondary', 'danger', 'invisible'] })
    expect(button.props.destructive?.deprecated).toBe('Use `variant="danger"` instead.')
    expect(ui.components.IconButton!.props['aria-label']).toEqual({ required: true })
    expect(ui.components.Box!.deprecated).toBe('Use `Stack` instead. Removed in v4.')
    expect(ui.components.Card!.subcomponents).toEqual(['Header', 'Body'])
    expect(ui.components.DataTable!.entryPoint).toBe('@vitals/ui/experimental')
  })

  it('reads DTCG tokens with aliases, types and deprecations', () => {
    const byName = Object.fromEntries(ui.tokens.map((t) => [t.name, t]))
    expect(byName['color.fg.default']).toEqual({ name: 'color.fg.default', cssVar: '--color-fg-default', values: ['#1f2328'], type: 'color' })
    expect(byName['space.2']).toMatchObject({ values: ['8px'], type: 'dimension' })
    expect(byName['radius.small']!.type).toBe('radius')
    expect(byName['font.size.body']).toMatchObject({ values: ['1rem'], type: 'fontSize' })
    expect(byName['color.brand.legacy']!.deprecated).toBe('Use color.bg.accent')
  })

  it('refuses to run when the installed version differs from the lockfile', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-'))
    fs.cpSync(app, tmp, { recursive: true })
    const lock = path.join(tmp, 'package-lock.json')
    fs.writeFileSync(lock, fs.readFileSync(lock, 'utf8').replace('"version": "3.1.2"', '"version": "3.0.0"'))
    expect(() => extractContract(tmp, [{ package: '@vitals/ui' }])).toThrow(ContractError)
  })

  it('accepts a DS linked from the same monorepo', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-'))
    fs.cpSync(app, tmp, { recursive: true })
    fs.rmSync(path.join(tmp, 'package-lock.json'))
    fs.writeFileSync(path.join(tmp, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      '@vitals/ui':\n        specifier: workspace:*\n        version: link:../packages/ui\n")
    const r = extractContract(tmp, [{ package: '@vitals/ui' }])
    expect(r.contract.packages[0]!.version).toBe('3.1.2')
    expect(r.notes[0]).toContain('linked locally')
  })

  it('caches contracts by name@version', () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-cache-'))
    extractContract(app, [{ package: '@vitals/ui' }], { cacheDir })
    expect(fs.readdirSync(cacheDir)[0]).toMatch(/^@vitals__ui@3\.1\.2-[0-9a-f]{12}\.json$/)
  })
})

describe('Tailwind v4 design system', () => {
  it('uses @theme files as token files and records the theme and its resets', () => {
    const { contract, notes } = extractContract(path.resolve(__dirname, '../../../fixtures/pulse-app'), [{ package: '@pulse/ui' }])
    const ui = contract.packages[0]!
    expect(notes).toEqual([])
    expect(ui.tokenSources).toEqual([{ spec: '@pulse/ui/theme.css', package: '@pulse/ui', version: '2.0.0' }])
    expect(ui.tailwind?.resets).toEqual(['color', 'radius'])
    expect(ui.tailwind?.vars).toContain('--color-brand')
    const type = (v: string) => ui.tokens.find((t) => t.cssVar === v)?.type
    expect([type('--color-brand'), type('--spacing'), type('--radius-card'), type('--text-body'), type('--text-body--line-height')]).toEqual(['color', 'dimension', 'radius', 'fontSize', 'dimension'])
  })
})

describe('lockfile readers', () => {
  const write = (name: string, text: string) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-lock-'))
    fs.writeFileSync(path.join(dir, name), text)
    return dir
  }
  it('pnpm v9 importers with peer suffixes', () => {
    const dir = write('pnpm-lock.yaml', `lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies:\n      '@vitals/ui':\n        specifier: ^3.1.0\n        version: 3.1.2(react@19.0.0)\n`)
    expect(findLockfile(dir)!.version('@vitals/ui')).toBe('3.1.2')
  })
  it('yarn v1 and berry', () => {
    expect(findLockfile(write('yarn.lock', `"@vitals/ui@^3.1.0":\n  version "3.1.2"\n  resolved "x"\n`))!.version('@vitals/ui')).toBe('3.1.2')
    expect(findLockfile(write('yarn.lock', `"@vitals/ui@npm:^3.1.0":\n  version: 3.1.2\n  resolution: "x"\n`))!.version('@vitals/ui')).toBe('3.1.2')
  })
})

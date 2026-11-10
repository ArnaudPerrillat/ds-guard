import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'
import plugin from '../src/index.js'

describe('eslint plugin', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-eslint-'))
  fs.mkdirSync(path.join(root, '.ds-guard'))
  fs.writeFileSync(path.join(root, '.ds-guard/contract.json'), JSON.stringify({
    schemaVersion: 1,
    packages: [{ name: '@vitals/ui', version: '3.1.2', entryPoints: ['@vitals/ui'], components: { Box: { name: 'Box', entryPoint: '@vitals/ui', deprecated: 'Use Stack.', props: {} } }, tokens: [{ name: 'space.2', cssVar: '--space-2', values: ['8px'], type: 'dimension' }] }],
  }))
  fs.writeFileSync(path.join(root, 'ds-exceptions.yml'), 'exceptions:\n  - id: EXC-1\n    rules: [no-hardcoded-spacing]\n    reason: r\n    owner: o\n    expires: 2999-01-01\n')

  it('reports core findings through ESLint and honours exceptions', () => {
    const linter = new Linter({ cwd: root })
    const code = `import { Box } from '@vitals/ui'\nexport const A = () => <Box><div style={{ padding: 8 }} />\n{/* ds-exception: EXC-1 */}\n<div style={{ margin: 8 }} /><img src="x" /></Box>`
    const msgs = linter.verify(code, [
      { files: ['**/*.tsx'], languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } } },
      { files: ['**/*.tsx'], ...(plugin.configs.recommended as object) },
    ], path.join(root, 'src/A.tsx'))
    expect(msgs.map((m) => [m.ruleId, m.line, m.severity])).toEqual([
      ['@ds-guard/no-deprecated-component', 2, 1],
      ['@ds-guard/no-hardcoded-spacing', 2, 1],
      ['@ds-guard/a11y-img-alt', 4, 2],
    ])
  })
})

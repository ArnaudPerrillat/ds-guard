import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Resolver, toDocuments, type Contract } from '../src/index.js'

const contract: Contract = {
  schemaVersion: 1,
  packages: [{
    name: '@acme/ui', version: '1.0.0', entryPoints: ['@acme/ui'], tokens: [],
    components: {
      Button: { name: 'Button', entryPoint: '@acme/ui', props: {} },
      Menu: { name: 'Menu', entryPoint: '@acme/ui', props: {}, subcomponents: ['Item'] },
    },
  }],
}

describe('normalised model', () => {
  const { docs } = toDocuments([
    { path: 'src/Primary.tsx', content: `import { Button } from '@acme/ui'\nexport const Primary = React.forwardRef((p, ref) => <Button ref={ref} {...p} />)` },
    { path: 'src/Page.tsx', content: `import { Primary } from './Primary'\nimport * as UI from '@acme/ui'\nimport { Ghost } from '@acme/ui'\nexport default function Page() {\n  // ds-exception: EXC-1\n  return <div style={{ padding: 12, color: '#fff' }}><Primary /><UI.Menu.Item /><Ghost /><button aria-label="x" /></div>\n}` },
    { path: 'src/a.scss', content: `$x: 1px;\n.btn { padding: 4px 8px; --local: 3px; }` },
  ])
  const page = docs.find((d) => d.path === 'src/Page.tsx')!

  it('extracts elements, inline styles and annotations', () => {
    expect(page.elements.map((e) => e.tag)).toEqual(['div', 'Primary', 'UI.Menu.Item', 'Ghost', 'button'])
    expect(page.styles.map((s) => [s.prop, s.value])).toEqual([['padding', '12px'], ['color', '#fff']])
    expect(page.annotations).toEqual([{ exceptionId: 'EXC-1', line: 5 }])
    expect(page.components).toEqual([{ name: 'Page', exported: true, isDefault: true, rootTag: 'div' }])
  })

  it('parses scss declarations but not variable definitions', () => {
    const css = docs.find((d) => d.kind === 'css')!
    expect(css.styles).toMatchObject([{ prop: 'padding', value: '4px 8px', context: '.btn', loc: { line: 2 } }])
  })

  it('resolves DS components, namespaces, wrappers and unknown exports', () => {
    const r = new Resolver(docs, contract)
    const origins = Object.fromEntries(page.elements.map((e) => [e.tag, r.origin(page, e.tag)]))
    expect(origins['div']).toEqual({ kind: 'intrinsic' })
    expect(origins['Primary']).toEqual({ kind: 'ds', pkg: '@acme/ui', component: 'Button', via: ['src/Primary.tsx#Primary'] })
    expect(origins['UI.Menu.Item']).toMatchObject({ kind: 'ds', component: 'Menu', member: 'Item' })
    expect(origins['Ghost']).toEqual({ kind: 'ds-unknown', pkg: '@acme/ui', name: 'Ghost' })
  })
})

describe('isomorphism (ADR 0005)', () => {
  it('core sources import no Node built-ins', () => {
    const files: string[] = []
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))))
    walk(join(__dirname, '../src'))
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/from ['"](node:|fs|path|os|child_process|http|https|net)['"/]|\bprocess\.|\bfetch\(/)
  })
})

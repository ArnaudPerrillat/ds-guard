import type { Contract } from '../src/index.js'

/** Hand-written subset of the fixtures/vitals-app contract, so core tests do not depend on @ds-guard/contract. */
export const vitals: Contract = {
  schemaVersion: 1,
  packages: [{
    name: '@vitals/ui', version: '3.1.2', entryPoints: ['@vitals/ui', '@vitals/ui/experimental'],
    components: {
      Button: { name: 'Button', entryPoint: '@vitals/ui', props: { variant: { required: false, values: ['primary', 'secondary', 'danger', 'invisible'] }, destructive: { required: false, deprecated: 'Use `variant="danger"` instead.' } } },
      Box: { name: 'Box', entryPoint: '@vitals/ui', deprecated: 'Use `Stack` instead.', props: {} },
      Link: { name: 'Link', entryPoint: '@vitals/ui', props: { href: { required: true } } },
      Heading: { name: 'Heading', entryPoint: '@vitals/ui', props: {} },
      Card: { name: 'Card', entryPoint: '@vitals/ui', props: {}, subcomponents: ['Header', 'Body'] },
    },
    tokens: [
      { name: 'color.fg.default', cssVar: '--color-fg-default', values: ['#1f2328'], type: 'color' },
      { name: 'color.base.gray.900', cssVar: '--color-base-gray-900', values: ['#1f2328'], type: 'color' },
      { name: 'color.bg.default', cssVar: '--color-bg-default', values: ['#ffffff'], type: 'color' },
      { name: 'color.brand.legacy', cssVar: '--color-brand-legacy', values: ['#0a5f66'], type: 'color', deprecated: 'Use color.bg.accent' },
      { name: 'space.1', cssVar: '--space-1', values: ['4px'], type: 'dimension' },
      { name: 'space.2', cssVar: '--space-2', values: ['8px'], type: 'dimension' },
      { name: 'space.4', cssVar: '--space-4', values: ['16px'], type: 'dimension' },
      { name: 'radius.small', cssVar: '--radius-small', values: ['4px'], type: 'radius' },
      { name: 'font.size.body', cssVar: '--font-size-body', values: ['1rem'], type: 'fontSize' },
    ],
  }],
}

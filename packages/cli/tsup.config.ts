import { defineConfig } from 'tsup'

// Core and contract are bundled in, so `npm i -D @ds-guard/cli` is a single install.
export default defineConfig({
  entry: { cli: 'src/cli.ts', api: 'src/api.ts' },
  format: 'esm',
  dts: { entry: { api: 'src/api.ts' } },
  clean: true,
  noExternal: ['@ds-guard/core', '@ds-guard/contract'],
  external: ['typescript', 'postcss', 'postcss-scss', 'yaml'],
})

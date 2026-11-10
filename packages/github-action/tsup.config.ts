import { defineConfig } from 'tsup'

// GitHub runs actions straight from the repository, so the bundle is committed at /action.
// CommonJS, because the TypeScript compiler (bundled in) uses dynamic require().
export default defineConfig({
  entry: { index: 'src/index.ts' },
  outDir: '../../action',
  format: 'cjs',
  outExtension: () => ({ js: '.cjs' }),
  platform: 'node',
  target: 'node22',
  noExternal: [/.*/],
  clean: false,
  minify: true,
})

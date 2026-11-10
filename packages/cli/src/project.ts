// Node side of the CLI: config, file collection, contract, exceptions, git diff.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { extractContract, type DesignSystemConfig } from '@ds-guard/contract'
import { EXCEPTIONS_FILE, SCRIPT_EXT, STYLE_EXT, globToRegExp, type Config, type Contract, type SourceFile } from '@ds-guard/core'

export const CONFIG_FILE = 'ds-guard.config.json'
export const STATE_DIR = '.ds-guard'

export interface ProjectConfig extends Config {
  designSystems: DesignSystemConfig[]
  /** Globs relative to the project root. */
  include?: string[]
  exclude?: string[]
  /** Import aliases; read from tsconfig `paths` when omitted. */
  aliases?: Record<string, string>
}

export class UsageError extends Error {}

const DEFAULT_INCLUDE = ['**/*.{tsx,jsx,ts,js,css,scss}']
const DEFAULT_EXCLUDE = ['**/*.{test,spec,stories}.*', '**/__tests__/**', '**/__mocks__/**', '**/*.d.ts']
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.next', '.turbo', '.git', STATE_DIR, 'storybook-static'])

export function loadConfig(root: string): ProjectConfig {
  const file = path.join(root, CONFIG_FILE)
  if (!fs.existsSync(file)) throw new UsageError(`No ${CONFIG_FILE} in ${root}. Run \`npx ds-guard init\` first.`)
  let cfg: ProjectConfig
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectConfig } catch (e) { throw new UsageError(`${CONFIG_FILE} is not valid JSON: ${(e as Error).message}`) }
  if (!Array.isArray(cfg.designSystems) || !cfg.designSystems.length || cfg.designSystems.some((d) => typeof d?.package !== 'string'))
    throw new UsageError(`${CONFIG_FILE}: \`designSystems\` must list at least one { "package": "…" }.`)
  return cfg
}

export function collectFiles(root: string, cfg: ProjectConfig): SourceFile[] {
  const inc = (cfg.include ?? DEFAULT_INCLUDE).map(globToRegExp)
  const exc = [...DEFAULT_EXCLUDE, ...(cfg.exclude ?? [])].map(globToRegExp)
  const out: SourceFile[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(path.join(dir, e.name)); continue }
      const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join('/')
      if (!(SCRIPT_EXT.test(rel) || STYLE_EXT.test(rel)) || !inc.some((r) => r.test(rel)) || exc.some((r) => r.test(rel))) continue
      if (/\.config\.[cm]?[jt]s$/.test(rel)) continue
      out.push({ path: rel, content: fs.readFileSync(path.join(dir, e.name), 'utf8') })
    }
  }
  walk(root)
  return out
}

/** tsconfig `paths` such as "@/*": ["src/*"] -> { "@": "src" }. */
export function tsconfigAliases(root: string): Record<string, string> {
  const file = path.join(root, 'tsconfig.json')
  if (!fs.existsSync(file)) return {}
  const parsed = ts.readConfigFile(file, ts.sys.readFile).config as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } } | undefined
  const base = parsed?.compilerOptions?.baseUrl ?? '.'
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed?.compilerOptions?.paths ?? {})) {
    const target = v[0]
    if (!target || !k.endsWith('/*') || !target.endsWith('/*')) continue
    out[k.slice(0, -2)] = path.posix.normalize(path.posix.join(base, target.slice(0, -2)))
  }
  return out
}

export function loadContract(root: string, cfg: ProjectConfig): { contract: Contract; notes: string[] } {
  const res = extractContract(root, cfg.designSystems, { cacheDir: path.join(root, STATE_DIR, 'cache') })
  fs.mkdirSync(path.join(root, STATE_DIR), { recursive: true })
  fs.writeFileSync(path.join(root, STATE_DIR, 'contract.json'), JSON.stringify(res.contract, null, 1))
  return res
}

export function loadExceptions(root: string): { path: string; content: string } | undefined {
  const file = path.join(root, EXCEPTIONS_FILE)
  return fs.existsSync(file) ? { path: EXCEPTIONS_FILE, content: fs.readFileSync(file, 'utf8') } : undefined
}

/** Lines added or changed since `base` (merge-base), per file, from `git diff -U0`. */
export function changedLines(root: string, base: string): Map<string, Set<number>> {
  let diff: string
  try {
    diff = execFileSync('git', ['diff', '--unified=0', '--no-color', '--no-ext-diff', `${base}...HEAD`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    throw new UsageError(`git diff against ${base} failed. In CI, fetch enough history (fetch-depth: 0). ${(e as Error).message.split('\n')[0]}`)
  }
  const prefix = execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: root, encoding: 'utf8' }).trim()
  const out = new Map<string, Set<number>>()
  let file: string | null = null
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/^b\//, '')
      file = p === '/dev/null' || !p.startsWith(prefix) ? null : p.slice(prefix.length)
      if (file && !out.has(file)) out.set(file, new Set())
    }
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (m && file) for (let i = 0; i < Number(m[2] ?? 1); i++) out.get(file)!.add(Number(m[1]) + i)
  }
  return out
}

import fs from 'node:fs'
import path from 'node:path'
import { findInstalled, typedEntryPoints, type DesignSystemConfig } from '@ds-guard/contract'
import { EXCEPTIONS_FILE } from '@ds-guard/core'
import { CONFIG_FILE, STATE_DIR, UsageError, type ProjectConfig } from './project.js'

const DS_NAME = /(^|[/@-])(ui|ds|design-?system|components?|kit|react)($|[/-])|primer|carbon|polaris|spectrum|chakra|mui|mantine|fluent|base-?web|vitals/i
const TOKEN_NAME = /tokens?|primitives|theme|foundations/i
const THEME_VARIANT = /dark|high-?contrast|colorblind|tritanopia|dimmed|protanopia|deuteranopia/i

const EXCEPTIONS_TEMPLATE = `# Intentional exceptions: a declared deviation with an owner and an expiry date.
# Reference one in code with  // ds-exception: ID  (covers that line and the next).
exceptions: []
#  - id: EXC-001
#    rules: [no-hardcoded-spacing]
#    reason: Hero section uses an off-scale gap validated in design review.
#    owner: "@team-name"
#    expires: 2027-06-30
#    files: ["src/legacy/**"]   # optional: covers these files without annotations
`

export function init(root: string, opts: { ds?: string[]; tokens?: string[]; force?: boolean }): string[] {
  const log: string[] = []
  const cfgFile = path.join(root, CONFIG_FILE)
  if (fs.existsSync(cfgFile) && !opts.force) throw new UsageError(`${CONFIG_FILE} already exists (use --force to overwrite).`)
  const pkgFile = path.join(root, 'package.json')
  if (!fs.existsSync(pkgFile)) throw new UsageError(`No package.json in ${root}: run init at the root of the React app.`)
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter((d) => !/^(react|react-dom|@types\/.*|typescript)$/.test(d))

  const dsNames = opts.ds?.length ? opts.ds : deps.filter((d) => DS_NAME.test(d) && !TOKEN_NAME.test(d.split('/').pop()!) && hasComponents(root, d))
  if (!dsNames.length) throw new UsageError('No design-system package detected in package.json. Pass it explicitly: `npx ds-guard init --ds @your/ui`.')

  const tokenPkgs = deps.filter((d) => TOKEN_NAME.test(d))
  const systems: DesignSystemConfig[] = dsNames.map((name) => {
    if (!findInstalled(root, name)) throw new UsageError(`${name} is not installed. Run your package manager's install first.`)
    const tokens = opts.tokens?.length ? opts.tokens : discoverTokens(root, [name, ...tokenPkgs])
    log.push(`Design system: ${name}` + (tokens.length ? `\n  tokens: ${tokens.join('\n          ')}` : '\n  tokens: none found (edit "tokens" in the config to enable colour/spacing suggestions)'))
    return tokens.length ? { package: name, tokens } : { package: name }
  })

  const config: ProjectConfig = { designSystems: systems, include: ['src/**/*.{tsx,jsx,ts,js,css,scss}'] }
  if (!fs.existsSync(path.join(root, 'src'))) delete config.include
  fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2) + '\n')
  log.push(`Wrote ${CONFIG_FILE}`)

  const exFile = path.join(root, EXCEPTIONS_FILE)
  if (!fs.existsSync(exFile)) { fs.writeFileSync(exFile, EXCEPTIONS_TEMPLATE); log.push(`Wrote ${EXCEPTIONS_FILE}`) }

  const gi = path.join(root, '.gitignore')
  const current = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : ''
  if (!current.split(/\r?\n/).some((l) => l.trim() === `${STATE_DIR}/` || l.trim() === STATE_DIR)) {
    fs.writeFileSync(gi, current + (current && !current.endsWith('\n') ? '\n' : '') + `${STATE_DIR}/\n`)
    log.push(`Added ${STATE_DIR}/ to .gitignore`)
  }
  return log
}

function hasComponents(root: string, name: string): boolean {
  const pkg = findInstalled(root, name)
  return !!pkg && typedEntryPoints(pkg).length > 0
}

/** DTCG files first; otherwise CSS files that define many custom properties, default theme only. */
function discoverTokens(root: string, pkgs: string[]): string[] {
  const json: string[] = []
  const css: { spec: string; n: number }[] = []
  for (const name of pkgs) {
    const pkg = findInstalled(root, name)
    if (!pkg) continue
    for (const file of walk(pkg.dir, 5)) {
      const rel = path.relative(pkg.dir, file).split(path.sep).join('/')
      const spec = `${name}/${rel}`
      if (/(^|\/|\.)tokens\.json$/.test(rel)) json.push(spec)
      else if (rel.endsWith('.css') && !THEME_VARIANT.test(rel)) {
        const text = fs.readFileSync(file, 'utf8')
        const n = (text.match(/--[\w-]+\s*:/g) ?? []).length
        if (n >= 10 && n / Math.max(1, (text.match(/;/g) ?? []).length) > 0.8) css.push({ spec, n })
      }
    }
  }
  if (json.length) return json.slice(0, 8)
  return css.sort((a, b) => b.n - a.n).slice(0, 8).map((c) => c.spec)
}

function walk(dir: string, depth: number): string[] {
  if (depth < 0) return []
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p, depth - 1))
    else out.push(p)
  }
  return out
}

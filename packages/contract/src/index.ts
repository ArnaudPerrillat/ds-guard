import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { Contract, PackageContract, Token } from '@ds-guard/core'
import { extractComponents } from './components.js'
import { findInstalled, typedEntryPoints } from './install.js'
import { findLockfile } from './lockfile.js'
import { cssFiles, definedVars, readTokenFile, tailwindTheme } from './tokens.js'

export { findLockfile, type Lockfile } from './lockfile.js'
export { findInstalled, typedEntryPoints } from './install.js'
export { fromCss, fromDtcg } from './tokens.js'

/** Bumped whenever extraction changes, so cached contracts are rebuilt. */
export const EXTRACTOR_VERSION = 3

export interface DesignSystemConfig {
  /** npm package of the DS components, e.g. "@vitals/ui". */
  package: string
  /** Token files as module paths, e.g. "@vitals/tokens/tokens.json". Auto-discovered (DTCG) when omitted. */
  tokens?: string[]
}

export interface ExtractOptions {
  /** Directory where contracts are cached by name@version. Omit to disable caching. */
  cacheDir?: string
}

export class ContractError extends Error {}

export interface ExtractResult {
  contract: Contract
  notes: string[]
}

export function extractContract(projectDir: string, systems: DesignSystemConfig[], opts: ExtractOptions = {}): ExtractResult {
  const lock = findLockfile(projectDir)
  const notes: string[] = []
  if (!lock) notes.push('No lockfile found: using the installed versions.')

  const resolveVersion = (name: string) => {
    const installed = findInstalled(projectDir, name)
    if (!installed) throw new ContractError(`${name} is not installed. Run your package manager's install first.`)
    let locked = lock?.version(name)
    // A DS linked from the same monorepo (link:, workspace:, file:) has no registry version: the installed one is the truth.
    if (locked && !/^\d/.test(locked)) { notes.push(`${name} is linked locally (${locked}): using installed ${installed.version}.`); locked = installed.version }
    if (lock && !locked) notes.push(`${name} is not in ${path.basename(lock.path)}: using installed ${installed.version}.`)
    if (locked && locked !== installed.version)
      throw new ContractError(`${name}: lockfile resolves ${locked} but ${installed.version} is installed. Reinstall so the contract matches the lockfile.`)
    return installed
  }

  const packages: PackageContract[] = []
  for (const ds of systems) {
    const pkg = resolveVersion(ds.package)
    const tokenFiles = (ds.tokens ?? []).map((spec) => {
      const [name, file] = splitSpecifier(spec)
      const owner = name === ds.package ? pkg : resolveVersion(name)
      const abs = path.join(owner.dir, file)
      if (!fs.existsSync(abs)) throw new ContractError(`Token file not found: ${spec}`)
      return { spec, package: owner.name, version: owner.version, abs }
    })
    if (!ds.tokens) {
      // DTCG first; a Tailwind v4 DS that ships only CSS gets its @theme files as token files.
      const found = discoverDtcg(pkg.dir)
      if (!found.length) found.push(...cssFiles(pkg.dir).filter((f) => /@theme\b/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.resolve(f)))
      for (const abs of found) tokenFiles.push({ spec: pkg.name + '/' + path.relative(pkg.dir, abs).replaceAll('\\', '/'), package: pkg.name, version: pkg.version, abs })
      if (!tokenFiles.length) notes.push(`${pkg.name}: no token file configured or found; colour and spacing rules will not suggest tokens.`)
    }

    const key = createHash('sha1').update(JSON.stringify([EXTRACTOR_VERSION, pkg.name, pkg.version, tokenFiles.map((t) => [t.spec, t.version])])).digest('hex').slice(0, 12)
    const cacheFile = opts.cacheDir && path.join(opts.cacheDir, `${pkg.name.replace('/', '__')}@${pkg.version}-${key}.json`)
    if (cacheFile && fs.existsSync(cacheFile)) {
      packages.push(JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as PackageContract)
      continue
    }

    const entries = typedEntryPoints(pkg)
    if (!entries.length) throw new ContractError(`${pkg.name}@${pkg.version} ships no type declarations: DS Guard needs .d.ts files to read the component contract.`)
    const components = extractComponents(entries)
    const tokens: Token[] = []
    const seen = new Set<string>()
    for (const t of tokenFiles) for (const tok of readTokenFile(t.abs)) if (!seen.has(tok.name)) { seen.add(tok.name); tokens.push(tok) }

    const vars = definedVars(pkg.dir)
    for (const dir of new Set(tokenFiles.map((t) => findInstalled(projectDir, t.package)!.dir))) definedVars(dir, 6, vars)
    for (const t of tokens) if (t.cssVar) vars.delete(t.cssVar)
    const themeDirs = [pkg.dir, ...new Set(tokenFiles.map((t) => findInstalled(projectDir, t.package)!.dir))]
    const tailwind = tailwindTheme([...new Set(themeDirs.flatMap((d) => cssFiles(d)))])

    const contract: PackageContract = {
      name: pkg.name, version: pkg.version, entryPoints: entries.map((e) => e.specifier), components, tokens,
      knownVars: [...vars].sort(),
      tokenSources: tokenFiles.map((t) => ({ spec: t.spec, package: t.package, version: t.version })),
      ...(tailwind ? { tailwind } : {}),
    }
    if (cacheFile) {
      fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
      fs.writeFileSync(cacheFile, JSON.stringify(contract))
    }
    packages.push(contract)
  }
  return { contract: { schemaVersion: 1, packages }, notes }
}

function splitSpecifier(spec: string): [string, string] {
  const parts = spec.split('/')
  const n = spec.startsWith('@') ? 2 : 1
  return [parts.slice(0, n).join('/'), parts.slice(n).join('/')]
}

function discoverDtcg(dir: string, depth = 0): string[] {
  if (depth > 3) return []
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...discoverDtcg(p, depth + 1))
    else if (/^(.+\.)?tokens\.json$/.test(e.name)) out.push(p)
  }
  return out
}

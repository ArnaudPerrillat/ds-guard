import fs from 'node:fs'
import path from 'node:path'

export interface InstalledPackage {
  name: string
  version: string
  dir: string
  manifest: PackageManifest
}

export interface PackageManifest {
  name: string
  version: string
  types?: string
  typings?: string
  exports?: unknown
}

/** Finds a package in node_modules, walking up like Node's resolver (package.json is read directly, `exports` does not block it). */
export function findInstalled(projectDir: string, name: string): InstalledPackage | null {
  let dir = path.resolve(projectDir)
  for (;;) {
    const pkgDir = path.join(dir, 'node_modules', ...name.split('/'))
    const manifestPath = path.join(pkgDir, 'package.json')
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PackageManifest
      return { name, version: manifest.version, dir: fs.realpathSync(pkgDir), manifest }
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Public entry points with their type declarations: "." -> "@acme/ui", "./experimental" -> "@acme/ui/experimental". */
export function typedEntryPoints(pkg: InstalledPackage): { specifier: string; dts: string }[] {
  const out: { specifier: string; dts: string }[] = []
  const add = (sub: string, rel: string | undefined) => {
    if (!rel) return
    const dts = path.join(pkg.dir, rel)
    if (fs.existsSync(dts)) out.push({ specifier: sub === '.' ? pkg.name : pkg.name + sub.slice(1), dts })
  }
  const exp = pkg.manifest.exports
  if (exp && typeof exp === 'object' && !Array.isArray(exp) && Object.keys(exp).some((k) => k.startsWith('.'))) {
    for (const [sub, target] of Object.entries(exp as Record<string, unknown>)) {
      if (sub.includes('*') || sub === './package.json') continue
      add(sub, typesCondition(target))
    }
  }
  if (!out.length) add('.', pkg.manifest.types ?? pkg.manifest.typings ?? typesCondition(exp) ?? 'index.d.ts')
  return out
}

/** Picks the `types` path out of a (possibly nested) conditional export. */
function typesCondition(target: unknown): string | undefined {
  if (typeof target === 'string') return /\.d\.[cm]?ts$/.test(target) ? target : undefined
  if (Array.isArray(target)) return target.map(typesCondition).find(Boolean)
  if (target && typeof target === 'object') {
    const t = target as Record<string, unknown>
    if (typeof t.types === 'string') return t.types
    for (const key of ['import', 'module', 'default', 'require', 'node']) {
      const found = typesCondition(t[key])
      if (found) return found
    }
  }
  return undefined
}

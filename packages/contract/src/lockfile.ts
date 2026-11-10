// Reads the version of a dependency as resolved in the project's lockfile (ADR 0012).
// Supported: package-lock.json (v2/v3), pnpm-lock.yaml (v6+), yarn.lock (v1 and berry).

import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export interface Lockfile {
  kind: 'npm' | 'pnpm' | 'yarn'
  path: string
  /** Resolved version for a package name, from the importer that owns `projectDir`. */
  version(name: string): string | null
}

export function findLockfile(projectDir: string): Lockfile | null {
  let dir = path.resolve(projectDir)
  for (;;) {
    for (const [file, read] of [['pnpm-lock.yaml', readPnpm], ['package-lock.json', readNpm], ['yarn.lock', readYarn]] as const) {
      const p = path.join(dir, file)
      if (fs.existsSync(p)) return read(p, path.relative(dir, path.resolve(projectDir)).replaceAll('\\', '/'))
    }
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function readNpm(file: string, importer: string): Lockfile {
  const lock = JSON.parse(fs.readFileSync(file, 'utf8')) as { packages?: Record<string, { version?: string }>; dependencies?: Record<string, { version?: string }> }
  return {
    kind: 'npm', path: file,
    version(name) {
      const pkgs = lock.packages ?? {}
      const nested = importer ? pkgs[`${importer}/node_modules/${name}`] : undefined
      return nested?.version ?? pkgs[`node_modules/${name}`]?.version ?? lock.dependencies?.[name]?.version ?? null
    },
  }
}

function readPnpm(file: string, importer: string): Lockfile {
  const lock = YAML.parse(fs.readFileSync(file, 'utf8')) as { importers?: Record<string, Record<string, Record<string, { version: string } | string>>>; dependencies?: Record<string, { version: string } | string> }
  return {
    kind: 'pnpm', path: file,
    version(name) {
      const imp = lock.importers?.[importer || '.'] ?? {}
      for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        const dep = imp[group]?.[name] ?? (importer ? undefined : lock.dependencies?.[name])
        if (dep) return clean(typeof dep === 'string' ? dep : dep.version)
      }
      return null
    },
  }
}

function readYarn(file: string): Lockfile {
  const text = fs.readFileSync(file, 'utf8')
  return {
    kind: 'yarn', path: file,
    version(name) {
      // Entry headers look like: "@scope/name@^1.0.0", "@scope/name@npm:^1.0.0": (berry) or @scope/name@^1.0.0: (v1)
      const esc = name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
      const re = new RegExp(`^"?${esc}@[^\\n]*:\\s*\\n(?:\\s+.*\\n)*?\\s+version:?\\s+"?([^"\\s]+)"?`, 'm')
      return text.match(re)?.[1] ?? null
    },
  }
}

/** pnpm versions carry peer suffixes: "3.1.2(react@19.0.0)". */
const clean = (v: string) => v.replace(/\(.*$/, '').replace(/^.*@(?=\d)/, '')

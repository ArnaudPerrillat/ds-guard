// Resolves JSX tags to design-system components, following in-house wrappers across files.

import type { UiDocument, UiElement } from './model.js'
import type { Contract, PackageContract } from './types.js'

export type TagOrigin =
  | { kind: 'ds'; pkg: string; component: string; member?: string; via: string[] }
  | { kind: 'ds-unknown'; pkg: string; name: string }
  | { kind: 'intrinsic' }
  | { kind: 'local' }

export interface ResolvedElement {
  el: UiElement
  doc: UiDocument
  origin: TagOrigin
}

export function dsPackageOf(source: string, contract: Contract): PackageContract | undefined {
  return contract.packages.find((p) => source === p.name || source.startsWith(p.name + '/'))
}

const EXTS = ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js']

function normalise(path: string): string {
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '..') out.pop()
    else if (part && part !== '.') out.push(part)
  }
  return out.join('/')
}

export class Resolver {
  private docs: Map<string, UiDocument>
  private cache = new Map<string, TagOrigin>()

  constructor(docs: UiDocument[], private contract: Contract, private aliases: Record<string, string> = {}) {
    this.docs = new Map(docs.map((d) => [d.path, d]))
  }

  /** Resolves a module specifier written in `from` to a project file, or null for packages. */
  resolveFile(from: string, spec: string): string | null {
    let base: string | null = null
    if (spec.startsWith('.')) base = normalise(from.split('/').slice(0, -1).join('/') + '/' + spec)
    else for (const [prefix, dir] of Object.entries(this.aliases)) if (spec === prefix || spec.startsWith(prefix + '/')) base = normalise(dir + spec.slice(prefix.length))
    if (base === null) return null
    const stripped = base.replace(/\.(js|jsx|mjs)$/, '')
    for (const cand of [base, ...EXTS.map((e) => stripped + e)]) if (this.docs.has(cand)) return cand
    return null
  }

  origin(doc: UiDocument, tag: string, seen = new Set<string>()): TagOrigin {
    const key = doc.path + '#' + tag
    const cached = this.cache.get(key)
    if (cached) return cached
    const result = this.compute(doc, tag, seen)
    this.cache.set(key, result)
    return result
  }

  private compute(doc: UiDocument, tag: string, seen: Set<string>): TagOrigin {
    if (/^[a-z]/.test(tag) && !tag.includes('.')) return { kind: 'intrinsic' }
    const [head, ...rest] = tag.split('.')
    const key = doc.path + '#' + head
    if (seen.has(key)) return { kind: 'local' }
    seen.add(key)

    for (const imp of doc.imports) {
      const imported = imp.names[head!]
      if (imported === undefined) continue
      const pkg = dsPackageOf(imp.source, this.contract)
      if (pkg) {
        // Namespace import: UI.Button -> Button
        const name = imported === '*' ? rest.shift() : imported
        if (!name) return { kind: 'ds-unknown', pkg: pkg.name, name: tag }
        if (!pkg.components[name]) return { kind: 'ds-unknown', pkg: pkg.name, name }
        return { kind: 'ds', pkg: pkg.name, component: name, member: rest.join('.') || undefined, via: [] }
      }
      const file = this.resolveFile(doc.path, imp.source)
      if (!file || rest.length) return { kind: 'local' }
      const target = this.docs.get(file)!
      const comp = imported === 'default' ? target.components.find((c) => c.isDefault) : target.components.find((c) => c.name === imported && c.exported)
      if (!comp) return { kind: 'local' }
      return this.throughWrapper(target, comp.name, comp.rootTag, seen)
    }
    // Component defined in the same file.
    const local = doc.components.find((c) => c.name === head)
    if (local && !rest.length) return this.throughWrapper(doc, local.name, local.rootTag, seen)
    return { kind: 'local' }
  }

  private throughWrapper(doc: UiDocument, name: string, rootTag: string, seen: Set<string>): TagOrigin {
    const inner = this.origin(doc, rootTag, seen)
    if (inner.kind !== 'ds') return { kind: 'local' }
    return { ...inner, via: [`${doc.path}#${name}`, ...inner.via] }
  }

  elements(): ResolvedElement[] {
    const out: ResolvedElement[] = []
    for (const doc of this.docs.values())
      for (const el of doc.elements) out.push({ el, doc, origin: this.origin(doc, el.tag) })
    return out
  }
}

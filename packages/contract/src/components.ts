// Components and props from the DS type declarations, via the TypeScript type checker.

import ts from 'typescript'
import type { ComponentContract, PropContract } from '@ds-guard/core'

const MAX_PROPS = 400

export function extractComponents(entries: { specifier: string; dts: string }[]): Record<string, ComponentContract> {
  const program = ts.createProgram(entries.map((e) => e.dts), {
    jsx: ts.JsxEmit.ReactJSX, noEmit: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], skipLibCheck: true, types: [],
  })
  const checker = program.getTypeChecker()
  const components: Record<string, ComponentContract> = {}

  for (const entry of entries) {
    const sf = program.getSourceFile(entry.dts)
    const modSym = sf && checker.getSymbolAtLocation(sf)
    if (!modSym) continue
    for (const exp of checker.getExportsOfModule(modSym)) {
      if (!/^[A-Z]/.test(exp.name) || components[exp.name]) continue
      const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp
      if (!(sym.flags & ts.SymbolFlags.Value)) continue // types and interfaces
      const type = checker.getTypeOfSymbol(sym)
      const sigs = [...type.getCallSignatures(), ...type.getConstructSignatures()]
      const isExoticComponent = type.getProperty('$$typeof') !== undefined
      if (!sigs.length && !isExoticComponent) continue
      // Polymorphic components (`as` prop) add a generic overload; the plain signature carries the real props.
      const plain = sigs.filter((s) => !s.typeParameters?.length)
      const chosen = plain.length ? plain : sigs
      const comp: ComponentContract = { name: exp.name, entryPoint: entry.specifier, props: mergeProps(chosen, checker) }
      const deprecated = deprecation(exp, checker) ?? deprecation(sym, checker)
      if (deprecated !== undefined) comp.deprecated = deprecated
      const subs = type.getProperties().map((p) => p.name).filter((n) => /^[A-Z]/.test(n))
      if (subs.length) comp.subcomponents = subs
      components[exp.name] = comp
    }
  }
  return components
}

function mergeProps(sigs: readonly ts.Signature[], checker: ts.TypeChecker): Record<string, PropContract> {
  const merged: Record<string, PropContract> = {}
  for (const sig of sigs) {
    const param = sig.getParameters()[0]
    if (!param) continue
    for (const [name, p] of Object.entries(props(checker.getTypeOfSymbol(param), checker))) {
      const prev = merged[name]
      merged[name] = prev ? { ...prev, required: prev.required && p.required } : p
    }
  }
  return merged
}

function props(type: ts.Type, checker: ts.TypeChecker): Record<string, PropContract> {
  const out: Record<string, PropContract> = {}
  for (const p of type.getApparentProperties().slice(0, 2000)) {
    // Keep the DS's own props; inherited DOM/React attributes would bloat the contract.
    const decls = p.getDeclarations() ?? []
    if (decls.length && decls.every((d) => /[\\/]node_modules[\\/](@types[\\/]react|typescript)[\\/]/.test(d.getSourceFile().fileName))) continue
    const prop: PropContract = { required: !(p.flags & ts.SymbolFlags.Optional) }
    const deprecated = deprecation(p, checker)
    if (deprecated !== undefined) prop.deprecated = deprecated
    const values = literalValues(checker.getNonNullableType(checker.getTypeOfSymbol(p)))
    if (values) prop.values = values
    out[p.name] = prop
    if (Object.keys(out).length >= MAX_PROPS) break
  }
  return out
}

/** Union of string literals only (booleans and numbers are left out on purpose: fewer, surer checks). */
function literalValues(t: ts.Type): string[] | undefined {
  const parts = t.isUnion() ? t.types : [t]
  if (!parts.every((p) => p.isStringLiteral())) return undefined
  return parts.map((p) => (p as ts.StringLiteralType).value)
}

function deprecation(sym: ts.Symbol, checker: ts.TypeChecker): string | undefined {
  const tag = sym.getJsDocTags(checker).find((t) => t.name === 'deprecated')
  return tag ? ts.displayPartsToString(tag.text).trim() : undefined
}

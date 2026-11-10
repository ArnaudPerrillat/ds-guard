// Phase 0 spike — throwaway. Usage: node analyze.ts <appDir> <dsDir>
// Writes out/contract.json, out/usages.json, out/findings.json and prints a summary.
import ts from 'typescript'

import scss from 'postcss-scss'
import fs from 'node:fs'
import path from 'node:path'

const [appDir, dsDir] = process.argv.slice(2).map((p) => path.resolve(p))
const outDir = path.resolve('out')
fs.mkdirSync(outDir, { recursive: true })

const walk = (dir: string, exts: string[]): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, exts)
    return exts.some((x) => p.endsWith(x)) && !p.endsWith('.d.ts') ? [p] : []
  })
const rel = (p: string) => path.relative(appDir, p).replaceAll('\\', '/')

// ---------- 1. Lockfile: which DS version does the app actually resolve? ----------
function resolvedVersion(pkg: string): string | null {
  const lock = path.join(appDir, 'package-lock.json')
  if (fs.existsSync(lock)) return JSON.parse(fs.readFileSync(lock, 'utf8')).packages?.[`node_modules/${pkg}`]?.version ?? null
  const pnpm = path.join(appDir, 'pnpm-lock.yaml')
  if (fs.existsSync(pnpm)) {
    const m = fs.readFileSync(pnpm, 'utf8').match(new RegExp(`\\n\\s+'?${pkg.replace('/', '\\/')}@([^:'(]+)`))
    return m?.[1] ?? null
  }
  return null
}
const dsVersion = resolvedVersion('@primer/react')
const primVersion = resolvedVersion('@primer/primitives')
const dsPkgDir = path.join(dsDir, 'node_modules/@primer/react')
const primPkgDir = path.join(dsDir, 'node_modules/@primer/primitives')
const installed = (d: string) => JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8')).version
if (installed(dsPkgDir) !== dsVersion || installed(primPkgDir) !== primVersion) throw new Error(`Contract must match lockfile: ${dsVersion}/${primVersion}`)

// ---------- 2. Contract: components + props from .d.ts, tokens from primitives CSS ----------
function extractComponents() {
  const entry = path.join(dsPkgDir, 'dist', 'index.d.ts')
  const program = ts.createProgram([entry], { jsx: ts.JsxEmit.ReactJSX, noEmit: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] })
  const checker = program.getTypeChecker()
  const modSym = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!
  const components: Record<string, { props: string[]; subcomponents: string[] }> = {}
  for (const exp of checker.getExportsOfModule(modSym)) {
    if (!/^[A-Z]/.test(exp.name)) continue
    const sym = exp.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exp) : exp
    if (!(sym.flags & (ts.SymbolFlags.Value))) continue // types/interfaces only
    const type = checker.getTypeOfSymbol(sym)
    const sigs = [...type.getCallSignatures(), ...type.getConstructSignatures()]
    const isForwardRef = type.getProperty('$$typeof') !== undefined
    if (!sigs.length && !isForwardRef) continue
    const param = sigs[0]?.getParameters()[0]
    const props = param ? checker.getTypeOfSymbol(param).getApparentProperties().map((p) => p.name) : []
    const subcomponents = type.getProperties().map((p) => p.name).filter((n) => /^[A-Z]/.test(n))
    components[exp.name] = { props: props.filter((p) => !p.startsWith('aria-') && !p.startsWith('on')).slice(0, 400), subcomponents }
  }
  return components
}

type Token = { name: string; value: string }
function extractTokens() {
  const colors = new Map<string, string[]>() // normalized hex -> token names
  const sizes = new Map<number, string[]>() // px -> token names
  const raw: Token[] = []
  const files = [
    'dist/css/functional/themes/light.css',
    'dist/css/base/size/size.css',
    'dist/css/functional/size/size.css',
    'dist/css/functional/size/border.css',
  ]
  for (const f of files) {
    const css = fs.readFileSync(path.join(primPkgDir, f), 'utf8')
    for (const m of css.matchAll(/--([\w-]+):\s*([^;]+);/g)) raw.push({ name: m[1], value: m[2].trim() })
  }
  const byName = new Map(raw.map((t) => [t.name, t.value]))
  const resolve = (v: string, depth = 0): string => {
    const m = v.match(/^var\(--([\w-]+)\)$/)
    return m && depth < 10 && byName.has(m[1]) ? resolve(byName.get(m[1])!, depth + 1) : v
  }
  for (const t of raw) {
    const v = resolve(t.value)
    const hex = normColor(v)
    if (hex) push(colors, hex, t.name)
    const px = toPx(v)
    if (px !== null) push(sizes, px, t.name)
  }
  return { colors, sizes, count: raw.length }
}
const push = <K,>(m: Map<K, string[]>, k: K, v: string) => (m.get(k) ?? m.set(k, []).get(k)!).push(v)

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', red: '#ff0000', gray: '#808080', grey: '#808080', blue: '#0000ff', green: '#008000' }
function normColor(v: string): string | null {
  v = v.trim().toLowerCase()
  if (NAMED[v]) return NAMED[v]
  let m = v.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length === 8 && h.endsWith('ff')) h = h.slice(0, 6)
    return h.length === 6 || h.length === 8 ? '#' + h : null
  }
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (m) {
    const hx = (n: number) => n.toString(16).padStart(2, '0')
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return '#' + hx(+m[1]) + hx(+m[2]) + hx(+m[3]) + (a >= 1 ? '' : hx(Math.round(a * 255)))
  }
  return null
}
function toPx(v: string): number | null {
  const m = v.trim().match(/^(-?[\d.]+)(px|rem)$/)
  return m ? +(parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1)).toFixed(3) : null
}

// ---------- 3. Usages: imports of the DS, JSX elements, in-house wrappers ----------
const DS_PKG = /^@primer\/react(\/(experimental|deprecated|next))?$/
type FileInfo = {
  file: string
  dsImports: Map<string, string> // local name -> DS export
  localImports: Map<string, { from: string; name: string }> // local name -> resolved app file + exported name
  components: Map<string, string | null> // exported component name -> root JSX tag (raw)
  jsx: { tag: string; line: number }[]
}

function resolveAppImport(fromFile: string, spec: string): string | null {
  let base: string | null = null
  if (spec.startsWith('@/')) base = path.join(appDir, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  if (!base) return null
  for (const c of [base, base + '.tsx', base + '.ts', path.join(base, 'index.tsx'), path.join(base, 'index.ts')])
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  return null
}

function tagName(n: ts.JsxTagNameExpression): string {
  return n.getText()
}

// Root JSX tag of a component: unwrap memo()/forwardRef()/styled wrappers to the function,
// then look at its own (non-nested) return statements, last one wins (early returns are usually guards).
function componentFn(n: ts.Node): ts.SignatureDeclaration | null {
  if (ts.isFunctionDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return n
  if (ts.isCallExpression(n)) for (const a of n.arguments) { const f = componentFn(a); if (f) return f }
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) return componentFn(n.expression)
  return null
}
function jsxRootOf(e: ts.Expression | undefined): string | null {
  while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e))) e = e.expression
  if (!e) return null
  if (ts.isJsxElement(e)) return tagName(e.openingElement.tagName)
  if (ts.isJsxSelfClosingElement(e)) return tagName(e.tagName)
  if (ts.isJsxFragment(e)) {
    const kids = e.children.filter((c) => !ts.isJsxText(c) || c.text.trim())
    return kids.length === 1 && !ts.isJsxExpression(kids[0]) ? jsxRootOf(kids[0] as ts.Expression) : null
  }
  if (ts.isConditionalExpression(e)) return jsxRootOf(e.whenFalse) ?? jsxRootOf(e.whenTrue)
  return null
}
function rootJsx(node: ts.Node): string | null {
  const fn = componentFn(node)
  if (!fn || !fn.body) return null
  if (!ts.isBlock(fn.body)) return jsxRootOf(fn.body as ts.Expression)
  let last: string | null = null
  const visit = (n: ts.Node) => {
    if (ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n)) last = jsxRootOf(n.expression) ?? last
    ts.forEachChild(n, visit)
  }
  fn.body.statements.forEach(visit)
  return last
}

function parseApp(file: string): FileInfo {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const info: FileInfo = { file, dsImports: new Map(), localImports: new Map(), components: new Map(), jsx: [] }
  for (const st of src.statements) {
    if (ts.isImportDeclaration(st) && st.importClause) {
      const spec = (st.moduleSpecifier as ts.StringLiteral).text
      const named = st.importClause.namedBindings && ts.isNamedImports(st.importClause.namedBindings) ? st.importClause.namedBindings.elements : []
      const pairs: [string, string][] = named.map((e) => [e.name.text, (e.propertyName ?? e.name).text])
      if (st.importClause.name) pairs.push([st.importClause.name.text, 'default'])
      if (DS_PKG.test(spec)) pairs.forEach(([l, i]) => info.dsImports.set(l, i))
      else {
        const target = resolveAppImport(file, spec)
        if (target) pairs.forEach(([l, i]) => info.localImports.set(l, { from: target, name: i }))
      }
    }
    const isExported = (n: ts.Node) => ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    const isDefault = (n: ts.Node) => ts.canHaveModifiers(n) && ts.getModifiers(n)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    if (ts.isFunctionDeclaration(st) && st.name && /^[A-Z]/.test(st.name.text)) {
      const root = rootJsx(st)
      info.components.set(st.name.text, root)
      if (isDefault(st)) info.components.set('default', root)
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) && d.initializer) info.components.set(d.name.text, rootJsx(d.initializer))
      }
    }
    if (ts.isExportAssignment(st) && ts.isIdentifier(st.expression)) info.components.set('default', info.components.get(st.expression.text) ?? null)
    void isExported
  }
  const visit = (n: ts.Node) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      info.jsx.push({ tag: tagName(n.tagName), line: src.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
  return info
}

// ---------- 4. Hardcoded values: SCSS/CSS declarations + style/sx objects in TSX ----------
const COLOR_PROPS = /^(color|background(-color)?|border(-(top|right|bottom|left))?(-color)?|outline(-color)?|fill|stroke|box-shadow|text-decoration-color|caret-color)$/
const SPACE_PROPS = /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/
type Finding = { id: number; kind: 'color' | 'spacing'; file: string; line: number; prop: string; value: string; raw: string; suggestion: string[]; exact: boolean; context: string }
const findings: Finding[] = []

function checkDecl(file: string, line: number, prop: string, value: string, context: string, tokens: ReturnType<typeof extractTokens>) {
  prop = prop.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
  const v = value.replace(/!important/, '').trim()
  // v2: `var(\s*--` (fallback inside a multi-line var() was a false positive in the blind review)
  if (/var\(\s*--|\$|#\{|calc\(|theme\(|^inherit$|^initial$|^unset$/.test(v)) return // token / variable / computed
  if (COLOR_PROPS.test(prop)) {
    const colorRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(white|black|red|gray|grey|blue|green)\b/g
    for (const m of v.matchAll(colorRe)) {
      const hex = normColor(m[0])
      if (!hex) continue
      const exact = tokens.colors.get(hex) ?? []
      const preferred = exact.filter((t) => tokenFitsProp(t, prop))
      findings.push({ id: 0, kind: 'color', file: rel(file), line, prop, value: m[0], raw: v, suggestion: (preferred.length ? preferred : exact).slice(0, 3), exact: exact.length > 0, context })
    }
  }
  if (SPACE_PROPS.test(prop)) {
    for (const part of v.split(/\s+/)) {
      const px = toPx(part)
      if (px === null || px === 0) continue
      const abs = Math.abs(px)
      if (abs <= 1) continue // v2: ±1px are optical/border offsets, not spacing
      // v2: control-* tokens only for control-like selectors; otherwise base-size-* first, stack-* as alternative
      const isControl = /btn|button|input|control|toggle|select/i.test(context)
      const rank = (t: string) => (t.startsWith('control-') ? 0 : t.startsWith('stack-') ? 1 : 2) + (isControl && t.startsWith('control-') ? -1 : 0)
      const exact = (tokens.sizes.get(abs) ?? []).filter((t) => /^base-size-|^stack-(gap|padding)/.test(t) || (isControl && /^control-.*(gap|padding)/.test(t)))
      let suggestion = exact.sort((a, b) => (isControl ? rank(a) - rank(b) : rank(b) - rank(a))).slice(0, 2)
      if (!suggestion.length) {
        const near = [...tokens.sizes.keys()].filter((k) => (tokens.sizes.get(k) ?? []).some((t) => t.startsWith('base-size-'))).sort((a, b) => Math.abs(a - abs) - Math.abs(b - abs))[0]
        suggestion = [`~base-size-${near} (nearest, ${near}px)`]
      }
      findings.push({ id: 0, kind: 'spacing', file: rel(file), line, prop, value: part, raw: v, suggestion, exact: exact.length > 0, context })
    }
  }
}
function tokenFitsProp(t: string, prop: string) {
  if (prop === 'color' || prop === 'fill' || prop === 'caret-color') return /^fgColor-/.test(t)
  if (prop.startsWith('background')) return /^bgColor-/.test(t)
  if (prop.startsWith('border') || prop.startsWith('outline')) return /^borderColor-/.test(t)
  return true
}

function scanStyles(file: string, tokens: ReturnType<typeof extractTokens>) {
  const root = scss.parse(fs.readFileSync(file, "utf8"), { from: file })
  root.walkDecls((d) => {
    if (d.prop.startsWith('$') || d.prop.startsWith('--')) return // variable definitions are not usages
    const parent = d.parent as any
    const ctx = parent?.selector ?? parent?.name ?? ''
    checkDecl(file, d.source?.start?.line ?? 0, d.prop, d.value, ctx, tokens)
  })
}

function scanTsxStyles(file: string, tokens: ReturnType<typeof extractTokens>) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const visit = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && ['style', 'sx'].includes(n.name.getText()) && n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression && ts.isObjectLiteralExpression(n.initializer.expression)) {
      for (const p of n.initializer.expression.properties) {
        if (!ts.isPropertyAssignment(p)) continue
        const key = p.name.getText().replace(/['"]/g, '')
        const init = p.initializer
        const line = src.getLineAndCharacterOfPosition(p.getStart()).line + 1
        if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) checkDecl(file, line, key, init.text, `${n.name.getText()}={{}}`, tokens)
        else if (ts.isNumericLiteral(init) && SPACE_PROPS.test(key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())))
          checkDecl(file, line, key, init.text + 'px', `${n.name.getText()}={{}} (number)`, tokens)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(src)
}

// ---------- Run ----------
const t0 = performance.now()
const components = extractComponents()
const tokens = extractTokens()
fs.writeFileSync(path.join(outDir, 'contract.json'), JSON.stringify({ package: '@primer/react', version: dsVersion, primitives: primVersion, components, tokenCount: tokens.count, colorValues: tokens.colors.size, sizeValues: tokens.sizes.size }, null, 1))

const srcDir = path.join(appDir, 'src')
const tsFiles = walk(srcDir, ['.tsx', '.ts']).filter((f) => !/(^|\/)(tests?|__tests__|fixtures)\/|\.test\./.test(rel(f)))
const infos = new Map(tsFiles.map((f) => [f, parseApp(f)]))

// Resolve a JSX tag in a file to a DS component, following wrappers across files.
function resolveTag(info: FileInfo, tag: string, seen = new Set<string>()): { ds: string; via: string[] } | null {
  const [head, ...rest] = tag.split('.')
  const key = info.file + '#' + tag
  if (seen.has(key)) return null
  seen.add(key)
  if (info.dsImports.has(head)) return { ds: [info.dsImports.get(head)!, ...rest].join('.'), via: [] }
  const imp = info.localImports.get(head)
  if (imp && !rest.length) {
    const target = infos.get(imp.from)
    const root = target?.components.get(imp.name)
    if (target && root) {
      const r = resolveTag(target, root, seen)
      return r && { ds: r.ds, via: [`${rel(imp.from)}:${imp.name}`, ...r.via] }
    }
  }
  if (!imp && info.components.has(tag)) {
    const root = info.components.get(tag)
    if (root && root !== tag) {
      const r = resolveTag(info, root, seen)
      return r && { ds: r.ds, via: [`${rel(info.file)}:${tag}`, ...r.via] }
    }
  }
  return null
}

const direct: Record<string, number> = {}
const viaWrapper: Record<string, number> = {}
const wrappers = new Map<string, string>()
const unknownDs = new Set<string>()
let jsxTotal = 0, jsxCustom = 0
for (const info of infos.values()) {
  for (const { tag } of info.jsx) {
    jsxTotal++
    if (/^[a-z]/.test(tag)) continue // host elements
    jsxCustom++
    const r = resolveTag(info, tag)
    if (!r) continue
    const base = r.ds.split('.')[0]
    if (!components[base] && base !== 'default') unknownDs.add(r.ds)
    if (r.via.length) {
      viaWrapper[r.ds] = (viaWrapper[r.ds] ?? 0) + 1
      wrappers.set(r.via[0], r.ds + (r.via.length > 1 ? ` (via ${r.via.slice(1).join(' -> ')})` : ''))
    } else direct[r.ds] = (direct[r.ds] ?? 0) + 1
  }
}
const sortObj = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]))
fs.writeFileSync(path.join(outDir, 'usages.json'), JSON.stringify({ direct: sortObj(direct), viaWrapper: sortObj(viaWrapper), wrappers: Object.fromEntries(wrappers), notInContract: [...unknownDs] }, null, 1))

for (const f of walk(srcDir, ['.scss', '.css'])) scanStyles(f, tokens)
for (const f of tsFiles.filter((f) => f.endsWith('.tsx'))) scanTsxStyles(f, tokens)
findings.forEach((f, i) => (f.id = i + 1))
fs.writeFileSync(path.join(outDir, 'findings.json'), JSON.stringify(findings, null, 1))

const count = (k: string, exact?: boolean) => findings.filter((f) => f.kind === k && (exact === undefined || f.exact === exact)).length
console.log(JSON.stringify({
  ds: `@primer/react@${dsVersion} (lockfile), @primer/primitives@${primVersion}`,
  contract: { components: Object.keys(components).length, tokens: tokens.count },
  app: { tsFiles: tsFiles.length, jsxElements: jsxTotal, customJsx: jsxCustom, dsDirect: Object.values(direct).reduce((a, b) => a + b, 0), dsViaWrapper: Object.values(viaWrapper).reduce((a, b) => a + b, 0), wrappers: wrappers.size, notInContract: [...unknownDs] },
  findings: { total: findings.length, color: count('color'), colorExactToken: count('color', true), spacing: count('spacing'), spacingExactToken: count('spacing', true) },
  ms: Math.round(performance.now() - t0),
}, null, 1))

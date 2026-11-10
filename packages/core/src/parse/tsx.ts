import ts from 'typescript'
import type { Attr, AttrValue, ClassUse, Import, LocalComponent, StyleDecl, UiDocument, UiElement } from '../model.js'
import type { Location } from '../types.js'
import { findAnnotations } from './annotations.js'

/** Helpers whose string arguments are class lists. */
const CLASS_FNS = /^(cn|clsx|classnames|classNames|cx|twMerge|twJoin)$/
/** Variant helpers: base and variant values are class lists, the rest is configuration. */
const VARIANT_FNS = /^(cva|tv)$/

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())

export function parseTsx(path: string, content: string): UiDocument {
  const kind = path.endsWith('.tsx') || path.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true, kind)
  const loc = (n: ts.Node): Location => {
    const p = sf.getLineAndCharacterOfPosition(n.getStart(sf))
    return { file: path, line: p.line + 1, column: p.character + 1 }
  }

  const imports: Import[] = []
  const elements: UiElement[] = []
  const styles: StyleDecl[] = []
  const components: LocalComponent[] = []
  const definedVars: string[] = []
  const classes: ClassUse[] = []
  const exportedNames = new Set<string>()
  let defaultExport: string | undefined

  const styleDecls = (obj: ts.ObjectLiteralExpression, context: string): StyleDecl[] => {
    const out: StyleDecl[] = []
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) continue
      const key = p.name.getText(sf).replace(/['"`]/g, '')
      const init = p.initializer
      let value: string | undefined
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) value = init.text
      else if (ts.isNumericLiteral(init)) value = init.text + 'px' // React adds px to unitless numbers
      else if (ts.isPrefixUnaryExpression(init) && init.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(init.operand)) value = '-' + init.operand.text + 'px'
      if (key.startsWith('--')) definedVars.push(key)
      else if (value !== undefined) out.push({ prop: kebab(key), value, context, loc: loc(p) })
    }
    return out
  }

  // Static class names. A word touching an interpolation or a concatenation (`bg-${tone}-500`) is skipped:
  // it is only part of a class.
  const addWords = (raw: string, start: number, context: string, openLeft: boolean, openRight: boolean) => {
    for (const m of raw.matchAll(/\S+/g)) {
      if ((openLeft && m.index === 0) || (openRight && m.index + m[0].length === raw.length)) continue
      const p = sf.getLineAndCharacterOfPosition(start + m.index)
      classes.push({ cls: m[0], context, loc: { file: path, line: p.line + 1, column: p.character + 1 } })
      const v = m[0].match(/(?:^|:)\[(--[\w-]+):/) // arbitrary property `[--x:…]` defines a variable
      if (v) definedVars.push(v[1]!)
    }
  }
  const collect = (e: ts.Node, context: string, openLeft = false, openRight = false): void => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) addWords(e.getText(sf).slice(1, -1), e.getStart(sf) + 1, context, openLeft, openRight)
    else if (ts.isTemplateExpression(e)) {
      addWords(e.head.getText(sf).slice(1, -2), e.head.getStart(sf) + 1, context, false, true)
      for (const s of e.templateSpans) {
        const tail = ts.isTemplateTail(s.literal)
        addWords(s.literal.getText(sf).slice(1, tail ? -1 : -2), s.literal.getStart(sf) + 1, context, true, !tail)
        collect(s.expression, context)
      }
    } else if (ts.isConditionalExpression(e)) { collect(e.whenTrue, context); collect(e.whenFalse, context) }
    else if (ts.isBinaryExpression(e)) {
      const op = e.operatorToken.kind
      if (op === ts.SyntaxKind.PlusToken) { collect(e.left, context, openLeft, true); collect(e.right, context, true, openRight) }
      else if (op === ts.SyntaxKind.AmpersandAmpersandToken) collect(e.right, context)
      else if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) { collect(e.left, context); collect(e.right, context) }
    } else if (ts.isArrayLiteralExpression(e)) for (const x of e.elements) collect(x, context)
    else if (ts.isObjectLiteralExpression(e)) {
      for (const p of e.properties) if (ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name))) collect(p.name, context)
    } else if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) collect(e.expression, context)
    // Calls are visited on their own; identifiers and other expressions are not static.
  }
  const props = (o: ts.Node | undefined) => (o && ts.isObjectLiteralExpression(o) ? o.properties.filter(ts.isPropertyAssignment) : [])
  const collectVariants = (fn: string, args: readonly ts.Expression[]) => {
    const cfg = fn === 'cva' ? args[1] : args[0]
    if (fn === 'cva' && args[0]) collect(args[0], fn)
    for (const p of props(cfg)) {
      const key = p.name.getText(sf).replace(/['"]/g, '')
      if (key === 'base') collect(p.initializer, fn)
      else if (key === 'slots') for (const s of props(p.initializer)) collect(s.initializer, fn)
      else if (key === 'variants') for (const v of props(p.initializer)) for (const val of props(v.initializer)) {
        if (ts.isObjectLiteralExpression(val.initializer)) for (const s of props(val.initializer)) collect(s.initializer, fn) // tv slots per variant
        else collect(val.initializer, fn)
      }
      else if (key === 'compoundVariants' && ts.isArrayLiteralExpression(p.initializer))
        for (const c of p.initializer.elements) for (const q of props(c)) if (/^(class|className)$/.test(q.name.getText(sf))) collect(q.initializer, fn)
    }
  }

  const attrValue = (name: string, init: ts.JsxAttributeValue | undefined): AttrValue => {
    if (!init) return { kind: 'boolean', value: true }
    if (ts.isStringLiteral(init)) return { kind: 'string', value: init.text }
    if (ts.isJsxExpression(init) && init.expression) {
      const e = init.expression
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return { kind: 'string', value: e.text }
      if (ts.isNumericLiteral(e)) return { kind: 'number', value: Number(e.text) }
      if (e.kind === ts.SyntaxKind.TrueKeyword) return { kind: 'boolean', value: true }
      if (e.kind === ts.SyntaxKind.FalseKeyword) return { kind: 'boolean', value: false }
      // `style={{ '--x': v } as CSSProperties}` is the usual way to set a variable at runtime.
      let o: ts.Expression = e
      while (ts.isAsExpression(o) || ts.isSatisfiesExpression(o) || ts.isParenthesizedExpression(o)) o = o.expression
      if ((name === 'style' || name === 'sx') && ts.isObjectLiteralExpression(o)) return { kind: 'style', decls: styleDecls(o, name) }
    }
    return { kind: 'expression' }
  }

  const element = (opening: ts.JsxOpeningLikeElement, children: readonly ts.JsxChild[] | undefined, at: ts.Node) => {
    const attrs: Attr[] = []
    let hasSpread = false
    for (const a of opening.attributes.properties) {
      if (ts.isJsxSpreadAttribute(a)) { hasSpread = true; continue }
      const name = a.name.getText(sf)
      const value = attrValue(name, a.initializer)
      if ((name === 'className' || name === 'class') && a.initializer) collect(ts.isJsxExpression(a.initializer) ? a.initializer.expression ?? a.initializer : a.initializer, 'className')
      attrs.push({ name, value, loc: loc(a) })
      if (value.kind === 'style') styles.push(...value.decls)
    }
    let text = ''
    let hasDynamicChildren = false
    for (const c of children ?? []) {
      if (ts.isJsxText(c)) text += c.text
      else hasDynamicChildren = true
    }
    elements.push({ tag: opening.tagName.getText(sf), attrs, hasSpread, text: text.replace(/\s+/g, ' ').trim(), hasDynamicChildren, loc: loc(at) })
  }

  const visit = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && !n.importClause?.isTypeOnly) {
      const names: Record<string, string> = {}
      const c = n.importClause
      if (c?.name) names[c.name.text] = 'default'
      if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) names[c.namedBindings.name.text] = '*'
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings))
        for (const s of c.namedBindings.elements) if (!s.isTypeOnly) names[s.name.text] = (s.propertyName ?? s.name).text
      imports.push({ source: n.moduleSpecifier.text, names, loc: loc(n) })
    }
    if (ts.isCallExpression(n)) {
      const callee = n.expression.getText(sf).split('.').pop()!
      if (CLASS_FNS.test(callee)) for (const a of n.arguments) collect(a, callee)
      else if (VARIANT_FNS.test(callee)) collectVariants(callee, n.arguments)
    }
    if (ts.isJsxElement(n)) element(n.openingElement, n.children, n)
    if (ts.isJsxSelfClosingElement(n)) element(n, undefined, n)

    // Components: function declarations and `const X = (…) => …`, including memo()/forwardRef().
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) {
      const rootTag = rootTagOf(n, sf)
      const mods = ts.getModifiers(n) ?? []
      const exported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      const isDefault = mods.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
      if (rootTag) components.push({ name: n.name.text, exported, isDefault, rootTag })
    }
    if (ts.isVariableStatement(n)) {
      const exported = (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !/^[A-Z]/.test(d.name.text) || !d.initializer) continue
        const fn = unwrapComponent(d.initializer)
        const rootTag = fn && rootTagOf(fn, sf)
        if (rootTag) components.push({ name: d.name.text, exported, isDefault: false, rootTag })
      }
    }
    if (ts.isExportDeclaration(n) && !n.moduleSpecifier && n.exportClause && ts.isNamedExports(n.exportClause))
      for (const s of n.exportClause.elements) exportedNames.add((s.propertyName ?? s.name).text)
    if (ts.isExportAssignment(n) && ts.isIdentifier(n.expression)) defaultExport = n.expression.text

    ts.forEachChild(n, visit)
  }
  visit(sf)

  for (const c of components) {
    if (exportedNames.has(c.name)) c.exported = true
    if (defaultExport === c.name) c.isDefault = true
  }

  return { path, kind: 'tsx', imports, elements, styles, components, annotations: findAnnotations(content), definedVars, classes }
}

type Fn = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

function unwrapComponent(e: ts.Expression): Fn | null {
  if (ts.isArrowFunction(e) || ts.isFunctionExpression(e)) return e
  if (ts.isParenthesizedExpression(e)) return unwrapComponent(e.expression)
  // memo(fn), forwardRef(fn), React.memo(React.forwardRef(fn))
  if (ts.isCallExpression(e) && /(^|\.)(memo|forwardRef)$/.test(e.expression.getText()) && e.arguments[0]) return unwrapComponent(e.arguments[0])
  return null
}

function jsxTag(e: ts.Expression | undefined, sf: ts.SourceFile): string | null {
  if (!e) return null
  if (ts.isParenthesizedExpression(e)) return jsxTag(e.expression, sf)
  if (ts.isJsxElement(e)) return e.openingElement.tagName.getText(sf)
  if (ts.isJsxSelfClosingElement(e)) return e.tagName.getText(sf)
  return null
}

/** Root JSX tag rendered by a component: last top-level return wins (early returns are usually guards). */
function rootTagOf(fn: Fn, sf: ts.SourceFile): string | null {
  if (!fn.body) return null
  if (!ts.isBlock(fn.body)) return jsxTag(fn.body, sf)
  let tag: string | null = null
  const walk = (n: ts.Node): void => {
    if (ts.isFunctionLike(n)) return // nested functions return their own JSX
    if (ts.isReturnStatement(n)) tag = jsxTag(n.expression, sf) ?? tag
    ts.forEachChild(n, walk)
  }
  ts.forEachChild(fn.body, walk)
  return tag
}

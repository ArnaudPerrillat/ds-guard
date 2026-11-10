// Normalised UI model (ADR 0005): every surface (TSX, CSS, later Figma) is translated into this
// shape, and rules only ever look at it.

import type { Location } from './types.js'

export interface Import {
  /** Module specifier as written. */
  source: string
  /** Local name -> imported name ("default" and "*" included). */
  names: Record<string, string>
  loc: Location
}

export type AttrValue =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'expression' }
  | { kind: 'style'; decls: StyleDecl[] }

export interface Attr {
  name: string
  value: AttrValue
  loc: Location
}

export interface UiElement {
  /** Tag as written: "button", "Button", "ActionList.Item". */
  tag: string
  attrs: Attr[]
  hasSpread: boolean
  /** Concatenated static text children (used for accessible-name checks). */
  text: string
  /** True when the element has non-text children (expressions or elements). */
  hasDynamicChildren: boolean
  loc: Location
}

export interface StyleDecl {
  /** kebab-case property. */
  prop: string
  value: string
  /** Selector or attribute the declaration belongs to (e.g. ".btn", "style"). */
  context: string
  loc: Location
  /** Set when the declaration comes from a Tailwind class (ADR 0018). */
  tailwind?: TailwindOrigin
}

export interface TailwindOrigin {
  /** The class as written, variants included: "hover:bg-[#5b6472]/50". */
  cls: string
  /** Utility: "bg", "px", "rounded-t". */
  util: string
  /** Text before the utility (variants, "!", "-") and after its value ("/50", "!"), to rebuild a class. */
  before: string
  after: string
}

/** A static class name read from className, a class helper (cn, clsx, cva…) or @apply. */
export interface ClassUse {
  cls: string
  /** "className", the helper name, or "@apply". */
  context: string
  loc: Location
}

/** A component defined in the file whose rendered root is a single JSX tag. */
export interface LocalComponent {
  name: string
  exported: boolean
  isDefault: boolean
  rootTag: string
}

export interface Annotation {
  exceptionId: string
  /** Line of the comment; it covers that line and the next one. */
  line: number
}

export interface UiDocument {
  path: string
  kind: 'tsx' | 'css'
  imports: Import[]
  elements: UiElement[]
  styles: StyleDecl[]
  components: LocalComponent[]
  annotations: Annotation[]
  /** Custom properties defined in this file (--x: …), so local variables are not mistaken for DS tokens. */
  definedVars: string[]
  /** Static class names (Tailwind utilities, among others). */
  classes?: ClassUse[]
  /** Tailwind v4 theme namespaces this file resets in @theme ("color", or "*" for all). */
  themeResets?: string[]
}

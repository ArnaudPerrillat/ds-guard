// Public types of the DS Guard engine. Everything here is plain data (JSON-serialisable),
// so the same engine can run in the CLI, CI, an MCP server or a Figma plugin.

export type Severity = 'error' | 'warning' | 'info'

/** Contract of one design-system package at one published version. */
export interface PackageContract {
  name: string
  version: string
  /** Public entry points, e.g. "@acme/ui" and "@acme/ui/experimental". */
  entryPoints: string[]
  components: Record<string, ComponentContract>
  tokens: Token[]
  /** Every custom property defined in the CSS of the DS and token packages (themes included), for no-unknown-token. */
  knownVars?: string[]
  /** Where tokens came from, with the version resolved for their package. */
  tokenSources?: { spec: string; package: string; version: string }[]
  /** Tailwind v4 theme shipped by the DS, read statically from its @theme blocks (ADR 0018). */
  tailwind?: TailwindTheme
}

export interface TailwindTheme {
  /** Custom properties defined in @theme, e.g. "--color-brand", "--spacing". */
  vars: string[]
  /** Namespaces reset with `--<ns>-*: initial` ("color", "radius"…), or "*" for `--*: initial`. */
  resets: string[]
}

export interface ComponentContract {
  name: string
  entryPoint: string
  deprecated?: string
  props: Record<string, PropContract>
  /** Sub-components exposed as static members, e.g. ActionList.Item. */
  subcomponents?: string[]
}

export interface PropContract {
  required: boolean
  deprecated?: string
  /** Allowed values when the prop type is a union of string literals. */
  values?: string[]
}

export type TokenType = 'color' | 'dimension' | 'fontSize' | 'radius' | 'shadow' | 'other'

export interface Token {
  /** Token path, e.g. "color.fg.default". */
  name: string
  /** CSS custom property, e.g. "--color-fg-default". */
  cssVar?: string
  /** One value per theme/mode; matching uses any of them. */
  values: string[]
  type: TokenType
  deprecated?: string
}

/** The contract the code is evaluated against: one entry per DS package, at the lockfile version. */
export interface Contract {
  schemaVersion: 1
  packages: PackageContract[]
}

export interface SourceFile {
  /** POSIX path relative to the project root. */
  path: string
  content: string
}

export interface Location {
  file: string
  line: number
  column: number
}

export interface Fix {
  description: string
  /** Literal replacement for the reported text, when it is safe to apply. */
  replacement?: string
}

export interface Finding {
  ruleId: string
  severity: Severity
  message: string
  loc: Location
  /** The exact text the finding is about (value, tag, prop…). */
  subject: string
  fix?: Fix
  /** Set when a declared exception covers this finding. */
  exception?: { id: string; owner: string; expires: string }
}

export interface RuleConfig {
  /** "off" disables the rule. */
  severity?: Severity | 'off'
}

export interface Config {
  rules?: Record<string, RuleConfig>
  /** Rules whose unexcepted findings make the run fail. Defaults to accessibility rules. */
  blocking?: string[]
}

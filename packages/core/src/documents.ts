import type { UiDocument } from './model.js'
import { parseCss } from './parse/css.js'
import { parseTsx } from './parse/tsx.js'
import type { SourceFile } from './types.js'

export const SCRIPT_EXT = /\.(tsx|jsx|ts|js|mjs)$/
export const STYLE_EXT = /\.(css|scss)$/

export interface ParseError {
  path: string
  message: string
}

/** Translates source files into the normalised UI model. Unparseable files are reported, not thrown. */
export function toDocuments(files: SourceFile[]): { docs: UiDocument[]; errors: ParseError[] } {
  const docs: UiDocument[] = []
  const errors: ParseError[] = []
  for (const f of files) {
    try {
      if (STYLE_EXT.test(f.path)) docs.push(parseCss(f.path, f.content))
      else if (SCRIPT_EXT.test(f.path)) docs.push(parseTsx(f.path, f.content))
    } catch (e) {
      errors.push({ path: f.path, message: e instanceof Error ? e.message : String(e) })
    }
  }
  return { docs, errors }
}

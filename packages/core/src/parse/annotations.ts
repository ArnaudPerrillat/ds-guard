import type { Annotation } from '../model.js'

const ANNOTATION = /ds-exception:\s*([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)*)/g

/** Finds `ds-exception: ID[, ID]` in comments. Works for `//`, `/* *\/` and `{/* *\/}` alike. */
export function findAnnotations(content: string): Annotation[] {
  const out: Annotation[] = []
  const lines = content.split(/\r?\n/)
  lines.forEach((text, i) => {
    if (!/\/\/|\/\*/.test(text)) return
    for (const m of text.matchAll(ANNOTATION)) {
      for (const id of m[1]!.split(',')) out.push({ exceptionId: id.trim(), line: i + 1 })
    }
  })
  return out
}

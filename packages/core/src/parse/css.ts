import postcss from 'postcss'
import scss from 'postcss-scss'
import type { ClassUse, StyleDecl, UiDocument } from '../model.js'
import { findAnnotations } from './annotations.js'

export function parseCss(path: string, content: string): UiDocument {
  const styles: StyleDecl[] = []
  const definedVars: string[] = []
  const classes: ClassUse[] = []
  const themeResets: string[] = []
  const root = path.endsWith('.scss') ? scss.parse(content, { from: undefined }) : postcss.parse(content, { from: undefined })
  root.walkDecls((d) => {
    // Variable definitions ($x, --x) are not usages.
    const parent = d.parent as { selector?: string; name?: string; type?: string } | undefined
    // Tailwind v4: `--color-*: initial` in @theme removes the default palette.
    const reset = d.prop.match(/^--([\w-]*?)-?\*$/)
    if (reset && parent?.type === 'atrule' && parent.name === 'theme' && d.value.trim() === 'initial') themeResets.push(reset[1] || '*')
    if (d.prop.startsWith('--')) definedVars.push(d.prop)
    if (d.prop.startsWith('$') || d.prop.startsWith('--')) return
    styles.push({
      prop: d.prop.toLowerCase(),
      value: d.value,
      context: parent?.selector ?? parent?.name ?? '',
      loc: { file: path, line: d.source?.start?.line ?? 0, column: d.source?.start?.column ?? 0 },
    })
  })
  root.walkAtRules('apply', (a) => {
    const parent = a.parent as { selector?: string } | undefined
    const line = a.source?.start?.line ?? 0
    const col = (a.source?.start?.column ?? 0) + '@apply'.length + (a.raws.afterName?.length ?? 1)
    const single = !a.params.includes('\n')
    for (const m of a.params.matchAll(/\S+/g)) classes.push({ cls: m[0], context: parent?.selector ?? '@apply', loc: { file: path, line, column: single ? col + m.index : col } })
  })
  return { path, kind: 'css', imports: [], elements: [], styles, components: [], annotations: findAnnotations(content), definedVars, classes, themeResets }
}

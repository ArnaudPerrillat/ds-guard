// CSS value helpers shared by the contract extractor and the rules.

const NAMED: Record<string, string> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', gray: '#808080', grey: '#808080', blue: '#0000ff', green: '#008000',
}

/** Normalises a colour literal to lowercase #rrggbb or #rrggbbaa; null if not a literal colour. */
export function normColor(v: string): string | null {
  v = v.trim().toLowerCase()
  if (NAMED[v]) return NAMED[v]!
  let m = v.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let h = m[1]!
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
    if (h.length === 8 && h.endsWith('ff')) h = h.slice(0, 6)
    return h.length === 6 || h.length === 8 ? '#' + h : null
  }
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (m) {
    const hx = (n: number) => Math.min(255, n).toString(16).padStart(2, '0')
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
    return '#' + hx(+m[1]!) + hx(+m[2]!) + hx(+m[3]!) + (a >= 1 ? '' : hx(Math.round(a * 255)))
  }
  return null
}

/** px or rem (16px base) literal to a px number; null otherwise. */
export function toPx(v: string): number | null {
  const m = v.trim().match(/^(-?\d*\.?\d+)(px|rem)$/)
  return m ? +(parseFloat(m[1]!) * (m[2] === 'rem' ? 16 : 1)).toFixed(3) : null
}

export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(white|black|red|gray|grey|blue|green)\b/g

/** Values that are tokens, variables or computed: never reported as hard-coded. */
export function isIndirect(value: string): boolean {
  // `var(\s*--`: a fallback inside var() is not a usage (phase 0 false-positive class #1).
  return /var\(\s*--|\$[\w-]|#\{|@[\w-]|calc\(|theme\(|env\(|^\s*(inherit|initial|unset|revert|currentcolor|transparent|auto|none)\s*$/i.test(value)
}

export const PROP_GROUPS = {
  color: /^(color|background(-color)?|border(-(top|right|bottom|left|block|inline))?(-color)?|outline(-color)?|fill|stroke|text-decoration-color|caret-color|accent-color)$/,
  spacing: /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(gap|row-gap|column-gap)$/,
  radius: /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/,
  fontSize: /^font-size$/,
}

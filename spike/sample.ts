// Prints an evenly spaced sample of N findings with source context, for manual review.
import fs from 'node:fs'
import path from 'node:path'
const [appDir, n = '50'] = process.argv.slice(2)
const all = JSON.parse(fs.readFileSync('out/findings.json', 'utf8'))
const step = all.length / +n
const picked = Array.from({ length: +n }, (_, i) => all[Math.floor(i * step)])
fs.writeFileSync('out/sample.json', JSON.stringify(picked.map((f) => f.id)))
for (const f of picked) {
  const lines = fs.readFileSync(path.join(appDir, f.file), 'utf8').split(/\r?\n/)
  console.log(`#${f.id} ${f.kind} ${f.file}:${f.line} [${f.context}] ${f.prop}: ${f.raw}  -> ${f.suggestion.join(', ')}`)
  console.log('   | ' + lines[f.line - 1]?.trim())
}

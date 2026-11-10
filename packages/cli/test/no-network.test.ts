import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// Privacy guarantee (README, "Privacy"): the CLI never touches the network.
const dist = path.resolve(__dirname, '../dist')
const cli = path.join(dist, 'cli.js')
const guard = pathToFileURL(path.resolve(__dirname, 'support/no-network.mjs')).href
const fixture = path.resolve(__dirname, '../../../fixtures/vitals-app')

describe('no network access', () => {
  it('the guard itself blocks a network call', () => {
    const r = spawnSync(process.execPath, ['--import', guard, '-e', "fetch('https://example.com')"], { encoding: 'utf8' })
    expect(r.status).toBe(97)
  })

  it('init, contract, scan, report and exceptions run with every network API blocked', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsg-offline-'))
    fs.cpSync(fixture, dir, { recursive: true, filter: (p) => !p.includes('.ds-guard') })
    for (const args of [['contract'], ['scan'], ['report', '--out', path.join(dir, 'ds-guard-report')], ['exceptions'], ['init', '--force']]) {
      const r = spawnSync(process.execPath, ['--import', guard, cli, ...args, '--root', dir], { encoding: 'utf8' })
      expect(r.stderr).not.toContain('NETWORK ACCESS BLOCKED')
      expect([0, 1], `${args[0]}: ${r.stderr}`).toContain(r.status) // 1 = blocking findings in the fixture
    }
  })

  it('the published bundle imports no network module', () => {
    const net = /node:(https?|http2|net|tls|dgram|dns)\b|["'](https?|http2|net|tls|dgram|dns)["']|\bfetch\(|XMLHttpRequest|WebSocket/
    for (const f of fs.readdirSync(dist).filter((f) => f.endsWith('.js'))) {
      expect(fs.readFileSync(path.join(dist, f), 'utf8').match(net)?.[0], f).toBeUndefined()
    }
  })
})

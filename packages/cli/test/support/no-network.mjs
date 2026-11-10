// Preloaded with `node --import`: any network attempt aborts the process with exit code 97.
import dgram from 'node:dgram'
import dns from 'node:dns'
import http from 'node:http'
import http2 from 'node:http2'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'

const deny = (what) => () => {
  process.stderr.write(`NETWORK ACCESS BLOCKED: ${what}\n`)
  process.exit(97)
}
for (const [mod, name, fns] of [
  [net, 'net', ['connect', 'createConnection']],
  [tls, 'tls', ['connect']],
  [http, 'http', ['request', 'get']],
  [https, 'https', ['request', 'get']],
  [http2, 'http2', ['connect']],
  [dgram, 'dgram', ['createSocket']],
  [dns, 'dns', ['lookup', 'resolve', 'resolve4', 'resolve6']],
  [dns.promises, 'dns.promises', ['lookup', 'resolve']],
]) for (const fn of fns) mod[fn] = deny(`${name}.${fn}`)
net.Socket.prototype.connect = deny('net.Socket.connect')
globalThis.fetch = deny('fetch')
globalThis.WebSocket = deny('WebSocket')

import { runAction } from './action.js'

runAction(process.env, fetch).then(
  (r) => { process.exitCode = r.exitCode },
  (e: Error) => { console.log(`::error title=DS Guard::${e.message}`); process.exitCode = 2 },
)

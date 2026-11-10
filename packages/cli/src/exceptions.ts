// `ds-guard exceptions`: list, add, renew, close. The logic lives in core; this file does the IO.

import fs from 'node:fs'
import path from 'node:path'
import {
  ALL_RULES, EXCEPTIONS_FILE, RegistryEditError, addException, closeException, exceptionsOverview, nextExceptionId,
  parseExceptions, renderExceptionsText, renderReviewIssue, renewException,
} from '@ds-guard/core'
import { run } from './api.js'
import { collectFiles, loadConfig, UsageError } from './project.js'

interface Opts {
  within?: string; format?: string; rule?: string[]; reason?: string; owner?: string; until?: string
  id?: string; files?: string[]; link?: string
}

const NEXT_STEP = 'Commit it in a pull request: the DS team approves changes to ds-exceptions.yml (CODEOWNERS).'

export function exceptionsCommand(root: string, args: string[], o: Opts, now = new Date()): number {
  const file = path.join(root, EXCEPTIONS_FILE)
  const read = () => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
  const edit = (fn: (text: string) => string) => {
    try { fs.writeFileSync(file, fn(read())) } catch (e) { throw e instanceof RegistryEditError ? new UsageError(e.message) : e }
  }
  const [sub, id] = args

  if (!sub || sub === 'list') {
    const within = o.within === undefined ? 30 : Number(o.within)
    if (!Number.isInteger(within) || within < 0) throw new UsageError('--within must be a number of days.')
    const r = run({ root, now })
    const overview = exceptionsOverview(parseExceptions(read()).entries, r.summary.excepted, now, within)
    const format = o.format ?? 'text'
    if (format === 'text') process.stdout.write(renderExceptionsText(overview))
    else if (format === 'issue') process.stdout.write(renderReviewIssue(overview).body)
    else if (format === 'json') process.stdout.write(JSON.stringify({ ...overview, issue: renderReviewIssue(overview) }, null, 2) + '\n')
    else throw new UsageError(`Unknown --format ${format} (text, json, issue).`)
    return 0
  }

  if (sub === 'add') {
    const entries = parseExceptions(read()).entries
    const entry = {
      id: o.id ?? nextExceptionId(entries),
      rules: (o.rule ?? []).flatMap((r) => r.split(',')).map((r) => r.trim()).filter(Boolean),
      reason: o.reason ?? '', owner: o.owner ?? '', expires: o.until ?? '',
      ...(o.files?.length ? { files: o.files } : {}),
      ...(o.link ? { link: o.link } : {}),
    }
    const knownRules = new Set(ALL_RULES.filter((r) => r.category !== 'exceptions').map((r) => r.id))
    edit((t) => addException(t, entry, { now, knownRules }))
    console.log(`Added ${entry.id} to ${EXCEPTIONS_FILE} (owner ${entry.owner}, until ${entry.expires}).`)
    console.log(entry.files ? `It covers ${entry.files.join(', ')}.` : `Annotate the deviating line with \`// ds-exception: ${entry.id}\` (it covers that line and the next).`)
    console.log(NEXT_STEP)
    return 0
  }

  if (sub === 'renew' || sub === 'close') {
    if (!id) throw new UsageError(`Usage: ds-guard exceptions ${sub} <id>${sub === 'renew' ? ' --until <YYYY-MM-DD>' : ''}`)
    if (sub === 'renew') {
      if (!o.until) throw new UsageError('renew needs --until <YYYY-MM-DD>.')
      edit((t) => renewException(t, id, o.until!, { now }))
      console.log(`Renewed ${id} until ${o.until}. Say in the PR why it is still needed. ${NEXT_STEP}`)
      return 0
    }
    edit((t) => closeException(t, id))
    console.log(`Closed ${id}: removed from ${EXCEPTIONS_FILE} (Git history keeps it).`)
    const re = new RegExp(`ds-exception:\\s*${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`)
    let left: string[] = []
    try { left = collectFiles(root, loadConfig(root)).filter((f) => re.test(f.content)).map((f) => f.path) } catch { /* no config: skip the check */ }
    if (left.length) console.log(`Remove its annotations, or the findings come back: ${left.join(', ')}.`)
    console.log(NEXT_STEP)
    return 0
  }

  throw new UsageError(`Unknown subcommand "exceptions ${sub}" (list, add, renew, close).`)
}

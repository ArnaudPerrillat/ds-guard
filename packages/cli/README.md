# @ds-guard/cli

Design-system compliance for React + TypeScript, from the command line. Checks your code against the contract of the design system version resolved in your lockfile, tells accidental drift apart from declared exceptions (`ds-exceptions.yml`, `// ds-exception: ID`), and reports explained coverage and conformance.

Local and offline: no telemetry, no network calls. Your code never leaves your machine.

```bash
npm i -D @ds-guard/cli
npx ds-guard init     # detects the DS, writes ds-guard.config.json and ds-exceptions.yml
npx ds-guard scan     # findings; exit code 1 only for blocking accessibility findings
npx ds-guard report   # HTML report and one-page leadership report in ds-guard-report/
```

Requirements: Node 22+, the design system package installed and shipping `.d.ts` files.

Documentation, GitHub Action and ESLint plugin: https://github.com/ArnaudPerrillat/ds-guard

MIT license.

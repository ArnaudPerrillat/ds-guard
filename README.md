# DS Guard

> Working name. Phase 1 (MVP), not yet published on npm.

DS Guard is the compliance layer for design systems. It reviews every pull request — written by a human or an AI agent — against your design system's contract and accessibility rules, tells accidental drift apart from intentional exceptions, and measures adoption over time.

Local first: the analysis runs on your machine or in your CI, offline. Your code never leaves your infrastructure.

## Quick start (about 5 minutes)

Requirements: Node 22+, a React + TypeScript app whose design system package is installed (`node_modules` matches the lockfile) and ships `.d.ts` files.

Until the npm release, build the CLI once from this repository:

```bash
git clone https://github.com/ArnaudPerrillat/ds-guard.git && cd ds-guard
corepack enable && pnpm install && pnpm build
cd packages/cli && pnpm pack        # → ds-guard-cli-0.1.0.tgz
```

Then, at the root of your app:

```bash
npx --package /path/to/ds-guard-cli-0.1.0.tgz ds-guard init
npx --package /path/to/ds-guard-cli-0.1.0.tgz ds-guard scan
```

(After the npm release: `npm i -D @ds-guard/cli`, then `npx ds-guard init` and `npx ds-guard scan`.)

`init` detects the design system in `package.json` and its token files, writes `ds-guard.config.json` and an empty `ds-exceptions.yml`, and adds `.ds-guard/` (cache) to `.gitignore`. If detection picks the wrong package: `ds-guard init --force --ds @your/ui --tokens @your/tokens/dist/tokens.json`.

To try it without your own app, point it at the fixture in this repository: `node packages/cli/dist/cli.js scan --root fixtures/vitals-app`.

## Commands

| Command | What it does |
| --- | --- |
| `ds-guard init` | Detects the DS, writes the config and the exceptions registry. |
| `ds-guard scan` | Checks the code against the DS contract **at the version in your lockfile**. `--base origin/main` keeps only findings on changed lines. `--format text\|markdown\|json`, `--output <file>`, `--all`. Exit code 1 only for blocking findings (accessibility); `--fail-on never` to disable. |
| `ds-guard exceptions` | Lists exceptions by expiry with owners, covered findings and similar exceptions; `add`, `renew`, `close` edit `ds-exceptions.yml`. |
| `ds-guard report` | Writes `ds-guard-report/index.html` (coverage, conformance, versions, wrappers, exceptions, findings) and `leadership.html`, a one-page report for leadership. `--record` appends today's numbers to `ds-guard-history.json` (commit it) for the trend. |
| `ds-guard contract` | Extracts the contract only, to `.ds-guard/contract.json` (used by the ESLint plugin). |

## Configuration

`ds-guard.config.json`:

```json
{
  "designSystems": [{ "package": "@vitals/ui", "tokens": ["@vitals/tokens/tokens.json"] }],
  "include": ["src/**/*.{tsx,jsx,ts,js,css,scss}"],
  "exclude": ["src/generated/**"],
  "rules": { "prefer-ds-component": { "severity": "off" } },
  "blocking": ["a11y-img-alt", "a11y-accessible-name", "a11y-no-positive-tabindex"]
}
```

Tokens are read from DTCG JSON (preferred) or CSS custom properties. Several design systems can be listed. Import aliases come from `tsconfig.json` `paths`.

## Intentional exceptions

A deviation someone owns and has dated is not a bug. Declare it once, reference it in code:

```yaml
# ds-exceptions.yml
exceptions:
  - id: EXC-012
    rules: [no-hardcoded-spacing]
    reason: The welcome banner uses an off-scale spacing validated in design review.
    owner: "@care-journey"
    expires: 2027-03-31
```

```tsx
{/* ds-exception: EXC-012 */}
<section style={{ paddingTop: 185 }}>
```

An annotation covers its line and the next. `files: ["src/legacy/**"]` covers whole folders. When an exception expires, its findings count again. Rules and exceptions: [docs/regles.md](docs/regles.md) (French).

### Steering exceptions

Git is the source of truth: adding, renewing or closing an exception is a pull request on `ds-exceptions.yml`, approved by the DS team through `CODEOWNERS` (enable *Require review from Code Owners* on the main branch):

```
# .github/CODEOWNERS
**/ds-exceptions.yml      @acme/design-system
**/ds-guard.config.json   @acme/design-system
```

```bash
npx ds-guard exceptions                    # by expiry: expired, expiring within 30 days (--within N), owners, covered findings, similar exceptions
npx ds-guard exceptions add --rule no-hardcoded-color --reason "Campaign banner" --owner @care-journey --until 2027-01-31
npx ds-guard exceptions renew EXC-012 --until 2027-06-30
npx ds-guard exceptions close EXC-012     # also lists annotations left to remove
```

The commands edit the file in place, keeping comments and order. Several exceptions for one rule, especially from different teams, usually mean the DS is missing a component or token: they are grouped in the command output, the HTML report and the review issue.

**Weekly review issue.** Copy [templates/ds-guard-exceptions.yml](templates/ds-guard-exceptions.yml) to `.github/workflows/`. Every Monday it opens or updates one "DS Guard: exceptions to review" issue listing exceptions expired or expiring within 14 days, assigns their owners (`@org/team` owners are mentioned, since GitHub assigns users only) and closes it when nothing is due. It never fails. Decision: [ADR 0017](docs/adr/0017-pilotage-exceptions-git.md) (French).

## GitHub Action

```yaml
# .github/workflows/ds-guard.yml
name: DS Guard
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  ds-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - uses: ArnaudPerrillat/ds-guard@main
        # with:
        #   working-directory: apps/web
        #   fail-on: never        # fully advisory
```

One PR comment, updated on each push, with the findings on changed lines only, plus inline annotations and a job summary. It fails only on blocking accessibility findings introduced by the PR. Outputs: `explained-coverage`, `conformance`, `findings`, `blocking`.

## ESLint plugin

```js
// eslint.config.js
import dsGuard from '@ds-guard/eslint-plugin'
export default [{ files: ['**/*.{tsx,jsx}'], ...dsGuard.configs.recommended }]
```

Run `npx ds-guard contract` once (and after each DS upgrade) so the plugin has a contract to read.

## Privacy

- **No telemetry, no network calls.** The CLI and the ESLint plugin never open a connection: no analytics, no update check, no remote rules. They run fully offline.
- **Nothing leaves your machine.** Code, findings and reports stay in your working copy (`.ds-guard/` cache, `ds-guard-report/`). Sharing a number is always something you do yourself.
- **The GitHub Action** talks only to the GitHub API of the repository it runs in (`GITHUB_API_URL`), to post its PR comment with the workflow token, and runs `git fetch` against `origin` to find the PR base. Nothing else.

How to verify:

1. Read the code: it is open source, and the engine (`packages/core`) has no file system or network dependency by design.
2. Run it with the network off (airplane mode, `docker run --network none`, or a firewall rule): `init`, `contract`, `scan`, `report` and `exceptions` work the same.
3. Run the automated check: [`packages/cli/test/no-network.test.ts`](packages/cli/test/no-network.test.ts) preloads a guard that aborts on any use of `net`, `tls`, `http(s)`, `http2`, `dgram`, `dns`, `fetch` or `WebSocket`, runs the CLI on the fixture app, and also checks that the published bundle imports none of these modules.

## What is measured

- **Explained coverage**: share of the measured UI built from the design system or covered by a declared exception.
- **Conformance**: share of design system usages that follow the contract of the installed version (no deprecated API, no invalid value, no removed token).

Definition and limits: [docs/mesures.md](docs/mesures.md) (French). Tailwind: arbitrary values (`bg-[#5b6472]`) in `className`, `cn`/`clsx`/`cva` and `@apply`, plus Tailwind v4 `@theme` scales (v3 JS configs not read). Not covered yet: styled-components, CSS-in-JS templates.

## Repository

| Package | Role |
| --- | --- |
| `packages/core` | Isomorphic engine: parsing, rules, exceptions, metrics, reports. No file system, no network. |
| `packages/contract` | Reads the lockfile and the installed DS package; extracts components, props and tokens. |
| `packages/cli` | `ds-guard` command (bundles core and contract). |
| `packages/eslint-plugin` | The same rules for ESLint. |
| `packages/github-action` | Source of the action bundled in `action/`. |
| `templates/` | Workflow templates to copy (weekly exception review). |

`pnpm install && pnpm build && pnpm test`.

**Releasing.** Bump `packages/cli/package.json`, commit, then push a tag `vX.Y.Z`: [release.yml](.github/workflows/release.yml) builds, tests and attaches `ds-guard-cli-X.Y.Z.tgz` to a GitHub release. Publishing to npm is manual: `cd packages/cli && pnpm publish --access public`.

Project docs (French): [vision](docs/vision.md), [market research](docs/etude-marche.md), [action plan](docs/plan-action.md), [decision records](docs/adr/).

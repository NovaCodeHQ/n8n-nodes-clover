# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-23

## OVERVIEW

Project: **n8n-nodes-clover**

Self-hosted n8n community node package that exposes a single **Clover** node calling the Clover REST API directly (no adapter dependency).

### Stack

- **Language:** TypeScript 5.9
- **Runtime target:** CommonJS / ES2019 output
- **Framework/API:** n8n community nodes API v1
- **Primary tooling:** `@n8n/node-cli`, ESLint 9, Prettier 3, TypeScript
- **Integration layer:** Clover REST API v3 via n8n `requestWithAuthentication` (Bearer per-merchant token)
- **Package manager:** npm (`package-lock.json` committed)

## STRUCTURE

```text
.
├── .agents/                  # Local n8n-specific build guidance
├── .cto/                     # Review and decision records
├── .github/workflows/        # CI and publish automation
├── credentials/             # n8n credential definitions
├── nodes/Clover/     # Main node implementation, helpers, metadata, icons
├── dist/                    # Built output consumed by n8n
├── AGENTS.md                # This file
├── CLAUDE.md                # Delegates to AGENTS.md
├── README.md                # Human-facing package docs
├── eslint.config.mjs        # n8n self-hosted lint config
├── package.json             # Scripts, deps, n8n manifest
└── tsconfig.json            # TS compiler settings
```

### Key directories

- `nodes/Clover/`: Programmatic node implementation. `Clover.node.ts` contains node description, all resource/operation properties, and execution routing. `GenericFunctions.ts` holds the REST helper (base-URL resolution, Bearer auth, pagination, error mapping).
- `credentials/`: Contains `CloverApi.credentials.ts` for API token + merchant ID + environment (sandbox/NA/EU/LATAM) auth.
- `.agents/`: Project-local guidance from the n8n starter. Read these before editing node or credential files.
- `.cto/`: Review artifacts documenting self-hosted constraints and package decisions.
- `dist/`: Generated build output; do not hand-edit.

## COMMANDS

| Action             | Command               |
| ------------------ | --------------------- |
| Install            | `npm install`         |
| Clean install      | `npm ci`              |
| Type-check         | `npx tsc --noEmit`    |
| Lint               | `npm run lint`        |
| Lint fix           | `npm run lint:fix`    |
| Build              | `npm run build`       |
| Watch TS           | `npm run build:watch` |
| Run locally in n8n | `npm run dev`         |
| Release            | `npm run release`     |
| Pack smoke test    | `npm pack --dry-run`  |

## BUILD / RELEASE WORKFLOWS

- **CI:** `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, and `npm run build` on pushes/PRs to `main`.
- **Publish:** `.github/workflows/publish.yml` publishes on version tag push via GitHub Actions with npm provenance.
- **n8n manifest:** `package.json` → `n8n.credentials` and `n8n.nodes` must always point at the compiled files in `dist/`.

## CODING STANDARDS

- **TypeScript strictness:** `strict: true`, `noImplicitAny`, `noImplicitReturns`, `noUnusedLocals`, `strictNullChecks` enabled.
- **Module style:** CommonJS output with `esModuleInterop: true`.
- **Formatting:** Prettier uses tabs, semicolons, single quotes, trailing commas, `printWidth: 100`.
- **Node style:** This package uses a **programmatic node**, not a declarative HTTP node.
- **Execution pattern:**
  - Node description and parameter definitions live in `Clover.node.ts`
  - Per-resource execution is split into helper functions like `executeOrder`, `executePayment`, etc.
  - `execute()` makes direct authenticated REST calls (`{base}/v3/merchants/{merchantId}/...`) with no connect/disconnect lifecycle
  - Errors use `NodeApiError` / `NodeOperationError` and honor `continueOnFail()`
- **Property pattern:** Resource/operation routing is controlled with `displayOptions.show`. Be careful not to introduce overlapping duplicate parameter definitions.
- **Output pattern:** Clover API responses are returned as n8n `json` payloads with minimal transformation.

## WHERE TO LOOK

- **Main node source:** `nodes/Clover/Clover.node.ts`
- **Adapter helpers:** `nodes/Clover/GenericFunctions.ts`
- **Credential source:** `credentials/CloverApi.credentials.ts`
- **Node metadata/docs links:** `nodes/Clover/Clover.node.json`
- **Human docs:** `README.md`
- **Review history:** `.cto/reviews/2026-06-23-clover-package-review.md`
- **Key decision:** `.cto/decisions/2026-06-23-clover-self-hosted-adapter-alias.md`

## CONTEXT FILES TO READ FIRST

`CLAUDE.md` simply points at this file.

Use these local guides before editing matching areas:

- `/.agents/workflow.md` — planning and verification expectations
- `/.agents/nodes.md` + `/.agents/properties.md` — any node file under `nodes/`
- `/.agents/nodes-programmatic.md` — this project specifically uses the programmatic style
- `/.agents/credentials.md` — credential file changes
- `/.agents/versioning.md` — node versioning work

## TESTING REALITY

There is **no dedicated automated test suite** in this package right now.
Practical verification is:

1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run lint`
4. `npm run dev` and manual verification inside local n8n
5. Optional runtime smoke checks by importing compiled `dist/` files in Node

## IMPORTANT NOTES / GOTCHAS

- This package is **self-hosted only**. Cloud support has been explicitly disabled in `eslint.config.mjs` and `package.json` (`n8n.strict: false`).
- This package has **no runtime dependencies** beyond n8n peer deps. It calls the Clover REST API directly with the credential's Bearer token.
- If you rename nodes or credentials, update the `n8n` manifest paths in `package.json`.
- `dist/` is generated output. Edit `credentials/` and `nodes/` sources, then rebuild.
- For local `n8n-node dev`, **Node 22 LTS** is the safest choice; newer Node versions may have `isolated-vm` issues during full n8n boot.
- Keep README aligned with actual operations and self-hosted constraints.
- If package version changes, also update `CHANGELOG.md`.

## CURRENT NODE SHAPE

Single node: `Clover`

Resources currently implemented:

- `merchant`
- `order`
- `payment`
- `customer`
- `item`
- `category`
- `modifierGroup`
- `employee`

Representative operations include CRUD-style actions plus Clover-specific actions such as `pay` (order), `refund`/`void` (payment), and filtered `search`.

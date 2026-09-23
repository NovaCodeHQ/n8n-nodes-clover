[''EXECUTING PLAN'' - FOLLOW THE PLAN EXACTLY]

You are executing a structured plan. Your ONLY job is to implement the plan tasks below.

Rules:
- Work in strict task order, but never choose a task whose dependencies are unfinished
- If the next task is blocked by earlier work, complete the prerequisite task first, then return to it
- After completing each task, IMMEDIATELY call update_task to mark it done with notes
- Do NOT use the generic todo tracker/tool during execution; use update_task / update_tasks for plan progress
- Never say the task tracker is not exposing the numbered item; the numbered item is always the current task from this prompt
- If the current task is already completed, still call update_task on it and then continue to the next unfinished task
- IMPORTANT: Tasks with dependencies (blockedBy) CANNOT be completed until their blockers are done. The system enforces this - you will get an error if you try to complete a blocked task. Always complete prerequisite tasks first.
- Do NOT run diagnostics, linters, test suites, or skills unless a task explicitly asks for it
- Do NOT explore the codebase beyond what the current task requires
- Do NOT deviate from the plan - if something seems wrong, call update_task with status "blocked"
- If you notice worthwhile work OUTSIDE the plan, call add_task to capture it, then keep going

## Current task
t-001: Strip ServiceFusion adapter and packaging
Details: Remove adapter dep, vendor bundle and scripts

## Handoff
# Convert ServiceFusion n8n node to Clover POS API

## What is changing
Full replacement of the ServiceFusion integration with a Clover POS integration. Delete `nodes/ServiceFusion/` (node, GenericFunctions, vendor adapter bundle, SVGs), `credentials/ServiceFusionApi.credentials.ts`, `scripts/bundle-servicefusion-adapter.mjs`, and the `@pmip/servicefusion-adapter` dependency. Add `nodes/Clover/` (new programmatic node + REST helper), `credentials/CloverApi.credentials.ts`, Clover icons, and rename package metadata to `@novacodehq/n8n-nodes-clover`.

## Why
User wants a Clover POS node, not ServiceFusion. Clover is plain REST with per-merchant Bearer tokens, so the vendored OAuth adapter bundle and its build machinery go away — the new node is simpler (direct `requestWithAuthentication` calls, no connect/disconnect lifecycle).

## Approach
Keep the existing programmatic node architecture (resource/operation routing via `displayOptions.show`, per-resource `execute*` functions, `continueOnFail` + enriched `NodeApiError` handling, strict TS, Prettier tabs). Replace only the transport: a small `GenericFunctions.cloverApiRequest` helper that builds `{base}/v3/merchants/{merchantId}/...` URLs from the credential's environment selector, sets `Authorization: Bearer`, and normalizes Clover's `{ elements: [...] }` list responses. CRUD-style operations per resource (`getAll`, `get`, `create`, `update`, `delete`) plus a few custom actions (order pay, payment refund/void, filtered search).

## Decisions (user-confirmed)
- Full replacement, no side-by-side ServiceFusion support.
- v1 resources: Merchant, Order (+line items), Payment (+refund/void), Customer, Item, Category, ModifierGroup, Employee. Ecommerce charges, webhooks, and devices deferred.
- Credential: `apiToken` + `merchantId` + `environment` dropdown (Sandbox / NA prod / EU / LATAM) + optional custom base-URL override. No OAuth app flow in v1.
- Operation depth: CRUD parity with current node (not read-only).

## File paths
- Delete: `nodes/ServiceFusion/*`, `credentials/ServiceFusionApi.credentials.ts`, `scripts/bundle-servicefusion-adapter.mjs`, `scripts/copy-vendor-assets.mjs` (if adapter-only).
- Create: `credentials/CloverApi.credentials.ts`, `nodes/Clover/Clover.node.ts`, `nodes/Clover/GenericFunctions.ts`, `nodes/Clover/Clover.node.json`, `nodes/Clover/clover.svg`, `nodes/Clover/clover.dark.svg`.
- Edit: `package.json` (name, description, keywords, repo, n8n manifest, scripts, remove adapter + esbuild deps), `README.md`, `CHANGELOG.md`, `eslint.config.mjs` (if it references ServiceFusion).

## APIs / endpoints (Clover REST v3, https://docs.clover.com/dev/reference/api-reference-overview)
- Base: Sandbox `https://apisandbox.dev.clover.com`, NA `https://api.clover.com`, EU `https://api.eu.clover.com`, LATAM `https://api.la.clover.com`.
- Pattern: `{base}/v3/merchants/{mId}/orders`, `/payments`, `/customers`, `/items`, `/categories`, `/modifier_groups`, `/employees`, and `GET /v3/merchants/{mId}` (+ `?expand=...`).
- Auth: `Authorization: Bearer {apiToken}`. List: `?limit=&offset=&filter=&expand=`. Create/update via POST; delete via DELETE.
- Custom: `POST .../orders/{id}/payments` (pay), payment refund/void endpoints, `GET` with `filter=` for search.

## Patterns / constraints / gotchas
- Programmatic node style per `.agents/nodes-programmatic.md`; property routing per `.agents/properties.md`; credential rules per `.agents/credentials.md`.
- Strict TS (`noUnusedLocals`, etc.); Prettier tabs/single-quotes; `n8n.strict: false` self-hosted-only stays.
- No `dist/` hand-edits; rebuild via `npm run build`. Verify with `npx tsc --noEmit`, `npm run build`, `npm run lint` (no test suite exists).
- Clover tokens are per-merchant: credential test should `GET /v3/merchants/{mId}`.
- Money fields are integer cents; order state transitions (open to paid) must be respected by the pay action.


## All remaining tasks
t-001. Strip ServiceFusion adapter and packaging
   Details: Remove adapter dep, vendor bundle and scripts

t-002. Create CloverApi credential with test
   Details: Token, merchantId, environment, override + test

t-003. Build Clover REST helper (GenericFunctions)
   Details: Base URL, Bearer auth, paging, error mapping

t-004. Define Clover node description properties
   Details: 8 resources, CRUD + pay/refund/void/search

t-005. Implement merchant/order/payment executors
   Details: Merchant get, Order CRUD + pay, Payment ops

t-006. Implement customer/inventory/employee executors
   Details: Customer, Item, Category, Modifier, Employee

t-007. Update metadata, docs, and package manifest
   Details: node.json, icons, manifest, README, CHANGELOG

t-008. Verify type-check, build, and lint
   Details: Run tsc, build, lint; fix errors

Start with t-001 NOW.
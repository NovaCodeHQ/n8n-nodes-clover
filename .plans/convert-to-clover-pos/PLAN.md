# Convert ServiceFusion node to Clover POS API

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


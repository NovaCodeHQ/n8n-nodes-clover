# @novacodehq/n8n-nodes-clover

[![npm version](https://img.shields.io/npm/v/@novacodehq/n8n-nodes-clover)](https://www.npmjs.com/package/@novacodehq/n8n-nodes-clover)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Self-hosted n8n community node for [Clover](https://www.clover.com) point of sale. Provides a single **Clover** node with CRUD and payment operations across 8 resources, calling the Clover REST API directly.

## Package

```text
@novacodehq/n8n-nodes-clover
```

Published to npm under the `@novacodehq` scope. Built as an n8n community node package for **self-hosted n8n** instances only.

## Self-hosted only

This package is intended for **self-hosted n8n** only. It is not configured for n8n Cloud verification.

## Resources & operations

| Resource       | Operations                                    |
| -------------- | --------------------------------------------- |
| Merchant       | Get                                           |
| Order          | Get Many, Get, Create, Update, Delete, Pay    |
| Payment        | Get Many, Get, Refund, Void                   |
| Customer       | Get Many, Get, Create, Update, Delete, Search |
| Item           | Get Many, Get, Create, Update, Delete         |
| Category       | Get Many, Get, Create, Update, Delete         |
| Modifier Group | Get Many, Get, Create, Update, Delete         |
| Employee       | Get Many, Get                                 |

### Highlights

- **Order** supports `Pay` with an explicit tender and amount, plus filtering (`state=open`) and expanding related objects (`lineItems,payments`).
- **Payment** supports `Refund` (set the amount for a partial refund) and `Void` (recent, unsettled payments only — older transactions must be refunded instead).
- **Customer** `Search` filters server-side by first/last name and matches email and phone against the results.
- **Get Many** operations offer a `Return All` toggle with automatic `limit`/`offset` pagination, or a `Limit` for a single page.
- Money amounts are integer cents throughout, matching the Clover API.

## Installation

### From npm

```bash
npm install @novacodehq/n8n-nodes-clover
```

Then restart your self-hosted n8n instance.

### Local development

```bash
npm install
npm run build
npm run dev
```

## Credentials

Create a **Clover API** credential in n8n with:

| Field             | Required | Default                         |
| ----------------- | -------- | ------------------------------- |
| API Token         | Yes      | —                               |
| Merchant ID       | Yes      | —                               |
| Environment       | Yes      | `https://api.clover.com`        |
| Base URL Override | No       | — (uses Environment when empty) |

Clover tokens are per-merchant: generate a merchant-specific API token in the Clover developer dashboard and pair it with that merchant's 13-character merchant ID (found in the merchant dashboard browser URL). The credential test calls `GET /v3/merchants/{merchantId}`.

## Compatibility

| Requirement    | Notes                                                 |
| -------------- | ----------------------------------------------------- |
| n8n version    | Modern self-hosted n8n versions using `@n8n/node-cli` |
| Node.js        | 22 LTS recommended for `isolated-vm` compatibility    |
| Package format | `@n8n/node-cli` community node package                |
| n8n cloud      | Not supported — self-hosted only                      |

## Error handling

API errors are wrapped in `NodeApiError` enriched with the request method and URL for debugging. The node respects n8n's `continueOnFail` — errors on individual items produce error JSON outputs rather than failing the entire execution when enabled.

## Notes

- This package has no runtime dependencies. It calls the Clover REST API directly with the credential's Bearer token — there is no vendored adapter.
- Pick the Environment matching your region (Sandbox, North America, Europe, Latin America) or set a custom Base URL Override.
- Clover restricts payment history queries (currently rolling out a 90-day window). Use `filter` with time-based fields such as `createdTime` for large histories.
- For local development with `n8n-node dev`, Node.js 22 LTS is recommended for smoothest `isolated-vm` compatibility.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Clover API reference overview](https://docs.clover.com/dev/reference/api-reference-overview)
- [Merchant IDs and API tokens](https://docs.clover.com/dev/docs/merchant-id-and-api-token-for-development)

## Version history

See [CHANGELOG.md](CHANGELOG.md).

## License

MIT © [NovaCodeHQ](https://github.com/NovaCodeHQ)

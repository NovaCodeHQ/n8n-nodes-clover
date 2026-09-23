import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export const DEFAULT_CLOVER_BASE_URL = 'https://api.clover.com';

/**
 * Resolve the API base URL from credential data.
 * Base URL Override wins; otherwise the Environment option value (which
 * stores the full base URL); otherwise the production default.
 */
export function resolveBaseUrl(credentials: ICredentialDataDecryptedObject): string {
	const override = (credentials.baseUrlOverride as string | undefined)?.trim();
	const base = override || (credentials.environment as string) || DEFAULT_CLOVER_BASE_URL;
	return base.replace(/\/+$/, '');
}

export function getMerchantId(credentials: ICredentialDataDecryptedObject): string {
	return (credentials.merchantId as string) || '';
}

export interface CloverRequestOptions {
	method: IHttpRequestMethods;
	/** Path relative to `/v3/merchants/{merchantId}`, e.g. `/orders/abc123`. */
	path: string;
	qs?: IDataObject;
	body?: IDataObject;
}

/**
 * Make an authenticated Clover REST API request.
 * Auth (Bearer token) is applied from the `cloverApi` credential via
 * `requestWithAuthentication`. Errors are wrapped in NodeApiError with the
 * request method + URL attached for debugging.
 */
export async function cloverApiRequest(
	ctx: IExecuteFunctions,
	options: CloverRequestOptions,
): Promise<unknown> {
	const credentials = await ctx.getCredentials('cloverApi');
	const url = `${resolveBaseUrl(credentials)}/v3/merchants/${getMerchantId(credentials)}${options.path}`;
	const requestOptions: IHttpRequestOptions = {
		method: options.method,
		url,
		qs: options.qs,
		body: options.body,
	};

	try {
		return await ctx.helpers.requestWithAuthentication.call(ctx, 'cloverApi', requestOptions);
	} catch (error) {
		throw new NodeApiError(ctx.getNode(), error as JsonObject, {
			description: `Request: ${options.method} ${url}`,
		});
	}
}

/**
 * Extract item objects from a Clover API response.
 * List endpoints return `{ elements: [...] }`; single-object endpoints
 * return the object itself.
 */
export function toCloverItems(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		return response as IDataObject[];
	}
	if (response && typeof response === 'object') {
		const elements = (response as { elements?: unknown }).elements;
		if (Array.isArray(elements)) {
			return elements as IDataObject[];
		}
		return [response as IDataObject];
	}
	return [];
}

/**
 * Fetch all pages of a Clover list endpoint (`limit`/`offset` pagination)
 * and return the combined items.
 */
export async function cloverApiRequestAllItems(
	ctx: IExecuteFunctions,
	options: {
		path: string;
		qs?: IDataObject;
		pageSize?: number;
		maxResults?: number;
	},
): Promise<IDataObject[]> {
	const pageSize =
		options.pageSize && options.pageSize > 0 ? Math.min(options.pageSize, 1000) : 100;
	const baseQs = { ...(options.qs ?? {}) };
	delete baseQs.limit;
	delete baseQs.offset;

	const items: IDataObject[] = [];
	let offset = 0;
	for (;;) {
		const response = await cloverApiRequest(ctx, {
			method: 'GET',
			path: options.path,
			qs: { ...baseQs, limit: pageSize, offset },
		});
		const page = toCloverItems(response);
		items.push(...page);
		if (options.maxResults !== undefined && items.length >= options.maxResults) {
			return items.slice(0, options.maxResults);
		}
		if (page.length < pageSize) {
			break;
		}
		offset += pageSize;
	}
	return items;
}

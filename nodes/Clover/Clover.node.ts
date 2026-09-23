import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { cloverApiRequest, cloverApiRequestAllItems, toCloverItems } from './GenericFunctions';

const RESOURCES = [
	'merchant',
	'order',
	'payment',
	'customer',
	'item',
	'category',
	'modifierGroup',
	'employee',
] as const;
type Resource = (typeof RESOURCES)[number];

const RESOURCE_LABELS: Record<Resource, string> = {
	merchant: 'Merchant',
	order: 'Order',
	payment: 'Payment',
	customer: 'Customer',
	item: 'Item',
	category: 'Category',
	modifierGroup: 'Modifier Group',
	employee: 'Employee',
};

const OPERATIONS: Record<Resource, { name: string; value: string; action: string }[]> = {
	merchant: [{ name: 'Get', value: 'get', action: 'Get the merchant' }],
	order: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many orders' },
		{ name: 'Get', value: 'get', action: 'Get an order' },
		{ name: 'Create', value: 'create', action: 'Create an order' },
		{ name: 'Update', value: 'update', action: 'Update an order' },
		{ name: 'Delete', value: 'delete', action: 'Delete an order' },
		{ name: 'Pay', value: 'pay', action: 'Pay for an order' },
	],
	payment: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many payments' },
		{ name: 'Get', value: 'get', action: 'Get a payment' },
		{ name: 'Refund', value: 'refund', action: 'Refund a payment' },
		{ name: 'Void', value: 'void', action: 'Void a payment' },
	],
	customer: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many customers' },
		{ name: 'Get', value: 'get', action: 'Get a customer' },
		{ name: 'Create', value: 'create', action: 'Create a customer' },
		{ name: 'Update', value: 'update', action: 'Update a customer' },
		{ name: 'Delete', value: 'delete', action: 'Delete a customer' },
		{ name: 'Search', value: 'search', action: 'Search customers' },
	],
	item: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many items' },
		{ name: 'Get', value: 'get', action: 'Get an item' },
		{ name: 'Create', value: 'create', action: 'Create an item' },
		{ name: 'Update', value: 'update', action: 'Update an item' },
		{ name: 'Delete', value: 'delete', action: 'Delete an item' },
	],
	category: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many categories' },
		{ name: 'Get', value: 'get', action: 'Get a category' },
		{ name: 'Create', value: 'create', action: 'Create a category' },
		{ name: 'Update', value: 'update', action: 'Update a category' },
		{ name: 'Delete', value: 'delete', action: 'Delete a category' },
	],
	modifierGroup: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many modifier groups' },
		{ name: 'Get', value: 'get', action: 'Get a modifier group' },
		{ name: 'Create', value: 'create', action: 'Create a modifier group' },
		{ name: 'Update', value: 'update', action: 'Update a modifier group' },
		{ name: 'Delete', value: 'delete', action: 'Delete a modifier group' },
	],
	employee: [
		{ name: 'Get Many', value: 'getAll', action: 'Get many employees' },
		{ name: 'Get', value: 'get', action: 'Get an employee' },
	],
};

function returnAllProperty(resource: Resource): INodeProperties {
	return {
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: [resource], operation: ['getAll'] } },
	};
}

function limitProperty(resource: Resource): INodeProperties {
	return {
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: {
			show: { resource: [resource], operation: ['getAll'], returnAll: [false] },
		},
	};
}

function expandProperty(
	resource: Resource,
	operations: string[],
	description = 'Comma-separated related objects to expand in the response',
): INodeProperties {
	return {
		displayName: 'Expand',
		name: 'expand',
		type: 'string',
		default: '',
		placeholder: 'e.g. lineItems,payments',
		description,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

function compactObject(obj: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = value;
	}
	return out;
}

async function executeGetAll(
	ctx: IExecuteFunctions,
	path: string,
	itemIndex: number,
	withFilter: boolean,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	const qs: IDataObject = {};
	if (withFilter) {
		const filter = p('filter', '') as string;
		if (filter) qs.filter = filter;
	}
	const expand = p('expand', '') as string;
	if (expand) qs.expand = expand;
	if (p('returnAll', false)) {
		const items = await cloverApiRequestAllItems(ctx, { path, qs });
		return items.map((item) => ({ json: item }));
	}
	const limit = p('limit', 50) as number;
	const response = await cloverApiRequest(ctx, { method: 'GET', path, qs: { ...qs, limit } });
	return toCloverItems(response).map((item) => ({ json: item }));
}

function allProperties(): INodeProperties[] {
	const props: INodeProperties[] = [];

	props.push({
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: RESOURCES.map((r) => ({ name: RESOURCE_LABELS[r], value: r })),
		default: 'order',
	});

	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['merchant'] } },
		options: OPERATIONS.merchant,
		default: 'get',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['order'] } },
		options: OPERATIONS.order,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['payment'] } },
		options: OPERATIONS.payment,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['customer'] } },
		options: OPERATIONS.customer,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['item'] } },
		options: OPERATIONS.item,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['category'] } },
		options: OPERATIONS.category,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['modifierGroup'] } },
		options: OPERATIONS.modifierGroup,
		default: 'getAll',
	});
	props.push({
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['employee'] } },
		options: OPERATIONS.employee,
		default: 'getAll',
	});

	// ---------- Merchant ----------
	props.push(expandProperty('merchant', ['get']));

	// ---------- Order ----------
	const O = 'order';
	props.push(returnAllProperty(O));
	props.push(limitProperty(O));
	props.push({
		displayName: 'Filter',
		name: 'filter',
		type: 'string',
		default: '',
		placeholder: 'e.g. state=open',
		description: 'Clover filter expression for the query',
		displayOptions: { show: { resource: [O], operation: ['getAll'] } },
	});
	props.push(expandProperty(O, ['getAll', 'get']));
	props.push({
		displayName: 'Order ID',
		name: 'orderId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [O], operation: ['get', 'update', 'delete', 'pay'] } },
	});
	props.push({
		displayName: 'Currency',
		name: 'orderCurrency',
		type: 'string',
		default: '',
		placeholder: 'USD',
		description: 'Three-letter currency code. Defaults to the merchant currency when empty.',
		displayOptions: { show: { resource: [O], operation: ['create'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'orderAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [O], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Note', name: 'note', type: 'string', default: '' },
			{ displayName: 'State', name: 'state', type: 'string', default: '' },
			{ displayName: 'Title', name: 'title', type: 'string', default: '' },
		],
	});
	props.push({
		displayName: 'Amount',
		name: 'payAmount',
		type: 'number',
		default: 0,
		required: true,
		description: 'Payment amount in cents',
		displayOptions: { show: { resource: [O], operation: ['pay'] } },
	});
	props.push({
		displayName: 'Tender ID',
		name: 'payTenderId',
		type: 'string',
		default: '',
		description: 'ID of the tender to pay with (e.g. cash or card tender)',
		required: true,
		displayOptions: { show: { resource: [O], operation: ['pay'] } },
	});
	props.push({
		displayName: 'Note',
		name: 'payNote',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [O], operation: ['pay'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'payAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [O], operation: ['pay'] } },
		options: [
			{ displayName: 'Currency', name: 'currency', type: 'string', default: '' },
			{
				displayName: 'External Payment ID',
				name: 'externalPaymentId',
				type: 'string',
				default: '',
			},
			{ displayName: 'Tax Amount', name: 'taxAmount', type: 'number', default: 0 },
			{ displayName: 'Tip Amount', name: 'tipAmount', type: 'number', default: 0 },
		],
	});

	// ---------- Payment ----------
	const P = 'payment';
	props.push(returnAllProperty(P));
	props.push(limitProperty(P));
	props.push({
		displayName: 'Filter',
		name: 'filter',
		type: 'string',
		default: '',
		placeholder: 'e.g. createdTime>1700000000000',
		description: 'Clover filter expression for the query',
		displayOptions: { show: { resource: [P], operation: ['getAll'] } },
	});
	props.push(expandProperty(P, ['getAll', 'get']));
	props.push({
		displayName: 'Payment ID',
		name: 'paymentId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [P], operation: ['get', 'refund', 'void'] } },
	});
	props.push({
		displayName: 'Order ID',
		name: 'refundOrderId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the order the payment belongs to',
		displayOptions: { show: { resource: [P], operation: ['refund'] } },
	});
	props.push({
		displayName: 'Amount',
		name: 'refundAmount',
		type: 'number',
		default: 0,
		required: true,
		description: 'Refund amount in cents',
		displayOptions: { show: { resource: [P], operation: ['refund'] } },
	});
	props.push({
		displayName: 'Reason',
		name: 'refundReason',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [P], operation: ['refund'] } },
	});
	props.push({
		displayName: 'Order ID',
		name: 'voidOrderId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the order the payment belongs to',
		displayOptions: { show: { resource: [P], operation: ['void'] } },
	});

	// ---------- Customer ----------
	const C = 'customer';
	props.push(returnAllProperty(C));
	props.push(limitProperty(C));
	props.push({
		displayName: 'Filter',
		name: 'filter',
		type: 'string',
		default: '',
		description: 'Clover filter expression for the query',
		displayOptions: { show: { resource: [C], operation: ['getAll'] } },
	});
	props.push(expandProperty(C, ['getAll', 'get']));
	props.push({
		displayName: 'Customer ID',
		name: 'customerId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [C], operation: ['get', 'update', 'delete'] } },
	});
	props.push({
		displayName: 'First Name',
		name: 'customerFirstName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['create', 'update'] } },
	});
	props.push({
		displayName: 'Last Name',
		name: 'customerLastName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['create', 'update'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'customerAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [C], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Address Line 1', name: 'address1', type: 'string', default: '' },
			{ displayName: 'City', name: 'city', type: 'string', default: '' },
			{ displayName: 'Email Address', name: 'emailAddress', type: 'string', default: '' },
			{ displayName: 'Phone Number', name: 'phoneNumber', type: 'string', default: '' },
			{ displayName: 'State', name: 'state', type: 'string', default: '' },
			{ displayName: 'Zip', name: 'zip', type: 'string', default: '' },
		],
	});
	props.push({
		displayName: 'First Name',
		name: 'searchFirstName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['search'] } },
	});
	props.push({
		displayName: 'Last Name',
		name: 'searchLastName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['search'] } },
	});
	props.push({
		displayName: 'Email',
		name: 'searchEmail',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['search'] } },
	});
	props.push({
		displayName: 'Phone',
		name: 'searchPhone',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [C], operation: ['search'] } },
	});

	// ---------- Item ----------
	const I = 'item';
	props.push(returnAllProperty(I));
	props.push(limitProperty(I));
	props.push(expandProperty(I, ['getAll', 'get']));
	props.push({
		displayName: 'Item ID',
		name: 'itemId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [I], operation: ['get', 'update', 'delete'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'itemName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [I], operation: ['create'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'itemName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [I], operation: ['update'] } },
	});
	props.push({
		displayName: 'Price',
		name: 'itemPrice',
		type: 'number',
		default: 0,
		description: 'Price in cents',
		displayOptions: { show: { resource: [I], operation: ['create', 'update'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'itemAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [I], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Available', name: 'available', type: 'boolean', default: true },
			{ displayName: 'Code', name: 'code', type: 'string', default: '' },
			{ displayName: 'Hidden', name: 'hidden', type: 'boolean', default: false },
			{
				displayName: 'Price Type',
				name: 'priceType',
				type: 'options',
				options: [
					{ name: 'Fixed', value: 'FIXED' },
					{ name: 'Variable', value: 'VARIABLE' },
				],
				default: 'FIXED',
			},
			{ displayName: 'SKU', name: 'sku', type: 'string', default: '' },
		],
	});

	// ---------- Category ----------
	const G = 'category';
	props.push(returnAllProperty(G));
	props.push(limitProperty(G));
	props.push(expandProperty(G, ['getAll', 'get']));
	props.push({
		displayName: 'Category ID',
		name: 'categoryId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [G], operation: ['get', 'update', 'delete'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'categoryName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [G], operation: ['create'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'categoryName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [G], operation: ['update'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'categoryAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [G], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Show By Default', name: 'showByDefault', type: 'boolean', default: true },
			{ displayName: 'Sort Order', name: 'sortOrder', type: 'number', default: 0 },
		],
	});

	// ---------- Modifier Group ----------
	const MG = 'modifierGroup';
	props.push(returnAllProperty(MG));
	props.push(limitProperty(MG));
	props.push(expandProperty(MG, ['getAll', 'get']));
	props.push({
		displayName: 'Modifier Group ID',
		name: 'modifierGroupId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [MG], operation: ['get', 'update', 'delete'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'modifierGroupName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [MG], operation: ['create'] } },
	});
	props.push({
		displayName: 'Name',
		name: 'modifierGroupName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [MG], operation: ['update'] } },
	});
	props.push({
		displayName: 'Additional Fields',
		name: 'modifierGroupAdditionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: [MG], operation: ['create', 'update'] } },
		options: [
			{ displayName: 'Max Allowed', name: 'maxAllowed', type: 'number', default: 1 },
			{ displayName: 'Min Required', name: 'minRequired', type: 'number', default: 0 },
			{ displayName: 'Show By Default', name: 'showByDefault', type: 'boolean', default: true },
		],
	});

	// ---------- Employee ----------
	const E = 'employee';
	props.push(returnAllProperty(E));
	props.push(limitProperty(E));
	props.push(expandProperty(E, ['getAll', 'get']));
	props.push({
		displayName: 'Employee ID',
		name: 'employeeId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [E], operation: ['get'] } },
	});

	return props;
}

async function executeMerchant(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation !== 'get') {
		throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
	const expand = ctx.getNodeParameter('expand', itemIndex, '') as string;
	const qs: IDataObject = {};
	if (expand) qs.expand = expand;
	const response = await cloverApiRequest(ctx, { method: 'GET', path: '', qs });
	return [{ json: response as IDataObject }];
}

async function executeOrder(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/orders', itemIndex, true);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/orders/${p('orderId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'create': {
			const body: IDataObject = {};
			const currency = p('orderCurrency', '') as string;
			if (currency) body.currency = currency;
			Object.assign(body, compactObject(p('orderAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, { method: 'POST', path: '/orders', body });
			return [{ json: response as IDataObject }];
		}
		case 'update': {
			const body = compactObject(p('orderAdditionalFields', {}) as IDataObject);
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/orders/${p('orderId') as string}`,
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'delete': {
			const response = await cloverApiRequest(ctx, {
				method: 'DELETE',
				path: `/orders/${p('orderId') as string}`,
			});
			return [{ json: (response as IDataObject) ?? { success: true } }];
		}
		case 'pay': {
			const body: IDataObject = {
				tender: { id: p('payTenderId') as string },
				amount: p('payAmount') as number,
			};
			const note = p('payNote', '') as string;
			if (note) body.note = note;
			Object.assign(body, compactObject(p('payAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/orders/${p('orderId') as string}/payments`,
				body,
			});
			return [{ json: response as IDataObject }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

async function executePayment(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/payments', itemIndex, true);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/payments/${p('paymentId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'refund': {
			const body: IDataObject = {
				order: { id: p('refundOrderId') as string },
				payment: { id: p('paymentId') as string },
				amount: p('refundAmount') as number,
			};
			const reason = p('refundReason', '') as string;
			if (reason) body.reason = reason;
			const response = await cloverApiRequest(ctx, { method: 'POST', path: '/refunds', body });
			return [{ json: response as IDataObject }];
		}
		case 'void': {
			// Verify against the sandbox: voids only succeed on recent unsettled payments.
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/orders/${p('voidOrderId') as string}/payments/${p('paymentId') as string}/void`,
			});
			return [{ json: response as IDataObject }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

function nestedValues(item: IDataObject, collection: string, field: string): string[] {
	const coll = item[collection] as { elements?: unknown } | unknown[] | undefined;
	const arr = Array.isArray(coll) ? coll : coll?.elements;
	if (!Array.isArray(arr)) return [];
	return arr
		.map((entry) => (entry as IDataObject)?.[field])
		.filter((value): value is string => typeof value === 'string');
}

function buildCustomerBody(ctx: IExecuteFunctions, itemIndex: number): IDataObject {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	const body: IDataObject = {};
	const firstName = p('customerFirstName', '') as string;
	if (firstName) body.firstName = firstName;
	const lastName = p('customerLastName', '') as string;
	if (lastName) body.lastName = lastName;
	const additional = compactObject(p('customerAdditionalFields', {}) as IDataObject);
	if (additional.emailAddress) {
		body.emailAddresses = [{ emailAddress: additional.emailAddress }];
	}
	if (additional.phoneNumber) {
		body.phoneNumbers = [{ phoneNumber: additional.phoneNumber }];
	}
	const address: IDataObject = {};
	for (const key of ['address1', 'city', 'state', 'zip']) {
		const value = additional[key];
		if (typeof value === 'string' && value) address[key] = value;
	}
	if (Object.keys(address).length > 0) body.addresses = [address];
	return body;
}

async function executeCustomer(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/customers', itemIndex, true);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/customers/${p('customerId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'create': {
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: '/customers',
				body: buildCustomerBody(ctx, itemIndex),
			});
			return [{ json: response as IDataObject }];
		}
		case 'update': {
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/customers/${p('customerId') as string}`,
				body: buildCustomerBody(ctx, itemIndex),
			});
			return [{ json: response as IDataObject }];
		}
		case 'delete': {
			const response = await cloverApiRequest(ctx, {
				method: 'DELETE',
				path: `/customers/${p('customerId') as string}`,
			});
			return [{ json: (response as IDataObject) ?? { success: true } }];
		}
		case 'search': {
			const firstName = p('searchFirstName', '') as string;
			const lastName = p('searchLastName', '') as string;
			const email = p('searchEmail', '') as string;
			const phone = p('searchPhone', '') as string;
			if (!firstName && !lastName && !email && !phone) {
				throw new NodeOperationError(ctx.getNode(), 'Enter at least one search criterion', {
					itemIndex,
				});
			}
			const filters: string[] = [];
			if (firstName) filters.push(`firstName=${firstName}`);
			if (lastName) filters.push(`lastName=${lastName}`);
			const qs: IDataObject = { expand: 'emailAddresses,phoneNumbers' };
			if (filters.length > 0) qs.filter = filters.join(' AND ');
			const items = await cloverApiRequestAllItems(ctx, { path: '/customers', qs });
			const normalizedPhone = phone.replace(/\D/g, '');
			const matched = items.filter((item) => {
				if (email) {
					const emails = nestedValues(item, 'emailAddresses', 'emailAddress');
					if (!emails.some((e) => e.toLowerCase() === email.toLowerCase())) return false;
				}
				if (normalizedPhone) {
					const phones = nestedValues(item, 'phoneNumbers', 'phoneNumber');
					if (!phones.some((ph) => ph.replace(/\D/g, '') === normalizedPhone)) return false;
				}
				return true;
			});
			return matched.map((item) => ({ json: item }));
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

async function executeItem(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/items', itemIndex, false);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/items/${p('itemId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'create': {
			const body: IDataObject = {
				name: p('itemName') as string,
				price: p('itemPrice', 0) as number,
			};
			Object.assign(body, compactObject(p('itemAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, { method: 'POST', path: '/items', body });
			return [{ json: response as IDataObject }];
		}
		case 'update': {
			const body: IDataObject = {};
			const name = p('itemName', '') as string;
			if (name) body.name = name;
			// itemPrice defaults to 0, which is indistinguishable from unset;
			// setting a price of exactly 0 via update is not supported.
			const price = p('itemPrice', 0) as number;
			if (price) body.price = price;
			Object.assign(body, compactObject(p('itemAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/items/${p('itemId') as string}`,
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'delete': {
			const response = await cloverApiRequest(ctx, {
				method: 'DELETE',
				path: `/items/${p('itemId') as string}`,
			});
			return [{ json: (response as IDataObject) ?? { success: true } }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

async function executeCategory(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/categories', itemIndex, false);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/categories/${p('categoryId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'create': {
			const body: IDataObject = { name: p('categoryName') as string };
			Object.assign(body, compactObject(p('categoryAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: '/categories',
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'update': {
			const body: IDataObject = {};
			const name = p('categoryName', '') as string;
			if (name) body.name = name;
			Object.assign(body, compactObject(p('categoryAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/categories/${p('categoryId') as string}`,
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'delete': {
			const response = await cloverApiRequest(ctx, {
				method: 'DELETE',
				path: `/categories/${p('categoryId') as string}`,
			});
			return [{ json: (response as IDataObject) ?? { success: true } }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

async function executeModifierGroup(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/modifier_groups', itemIndex, false);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/modifier_groups/${p('modifierGroupId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		case 'create': {
			const body: IDataObject = { name: p('modifierGroupName') as string };
			Object.assign(body, compactObject(p('modifierGroupAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: '/modifier_groups',
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'update': {
			const body: IDataObject = {};
			const name = p('modifierGroupName', '') as string;
			if (name) body.name = name;
			Object.assign(body, compactObject(p('modifierGroupAdditionalFields', {}) as IDataObject));
			const response = await cloverApiRequest(ctx, {
				method: 'POST',
				path: `/modifier_groups/${p('modifierGroupId') as string}`,
				body,
			});
			return [{ json: response as IDataObject }];
		}
		case 'delete': {
			const response = await cloverApiRequest(ctx, {
				method: 'DELETE',
				path: `/modifier_groups/${p('modifierGroupId') as string}`,
			});
			return [{ json: (response as IDataObject) ?? { success: true } }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

async function executeEmployee(
	ctx: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const p = (n: string, f?: unknown) => ctx.getNodeParameter(n, itemIndex, f);
	switch (operation) {
		case 'getAll':
			return executeGetAll(ctx, '/employees', itemIndex, false);
		case 'get': {
			const expand = p('expand', '') as string;
			const qs: IDataObject = {};
			if (expand) qs.expand = expand;
			const response = await cloverApiRequest(ctx, {
				method: 'GET',
				path: `/employees/${p('employeeId') as string}`,
				qs,
			});
			return [{ json: response as IDataObject }];
		}
		default:
			throw new NodeOperationError(ctx.getNode(), `Unknown operation: ${operation}`);
	}
}

export class Clover implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Clover',
		name: 'clover',
		icon: { light: 'file:clover.svg', dark: 'file:clover.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Clover POS API',
		defaults: {
			name: 'Clover',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'cloverApi',
				required: true,
			},
		],
		properties: allProperties(),
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as Resource;
				const operation = this.getNodeParameter('operation', i) as string;

				let result: INodeExecutionData[];
				switch (resource) {
					case 'merchant':
						result = await executeMerchant(this, operation, i);
						break;
					case 'order':
						result = await executeOrder(this, operation, i);
						break;
					case 'payment':
						result = await executePayment(this, operation, i);
						break;
					case 'customer':
						result = await executeCustomer(this, operation, i);
						break;
					case 'item':
						result = await executeItem(this, operation, i);
						break;
					case 'category':
						result = await executeCategory(this, operation, i);
						break;
					case 'modifierGroup':
						result = await executeModifierGroup(this, operation, i);
						break;
					case 'employee':
						result = await executeEmployee(this, operation, i);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
							itemIndex: i,
						});
				}

				for (const entry of result) {
					returnData.push({ ...entry, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error.message, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

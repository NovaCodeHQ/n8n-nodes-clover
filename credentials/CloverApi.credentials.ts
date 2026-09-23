import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class CloverApi implements ICredentialType {
	name = 'cloverApi';

	displayName = 'Clover API';

	icon = 'file:clover.svg' as const;

	documentationUrl = 'https://docs.clover.com/dev/docs/merchant-id-and-api-token-for-development';

	properties: INodeProperties[] = [
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Merchant API token from the Clover developer dashboard. Generate one token per merchant.',
		},
		{
			displayName: 'Merchant ID',
			name: 'merchantId',
			type: 'string',
			default: '',
			required: true,
			description: '13-character merchant ID. Find it in the merchant dashboard browser URL.',
		},
		{
			displayName: 'Environment',
			name: 'environment',
			type: 'options',
			options: [
				{
					name: 'Sandbox',
					value: 'https://api.clover.com',
				},
				{
					name: 'Production (North America)',
					value: 'https://api.clover.com',
				},
				{
					name: 'Production (Europe)',
					value: 'https://api.eu.clover.com',
				},
				{
					name: 'Production (Latin America)',
					value: 'https://api.la.clover.com',
				},
			],
			default: 'https://apisandbox.dev.clover.com',
			description: 'Clover API base URL for your region. Overridden by Base URL Override when set.',
		},
		{
			displayName: 'Base URL Override',
			name: 'baseUrlOverride',
			type: 'string',
			default: '',
			description: 'Optional custom base URL. Takes precedence over Environment when set.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrlOverride || $credentials.environment}}',
			url: '=/v3/merchants/{{$credentials.merchantId}}',
			method: 'GET',
		},
	};
}

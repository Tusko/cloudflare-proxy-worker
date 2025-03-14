import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import axios, { AxiosHeaders, AxiosRequestConfig } from 'axios';

type Bindings = {
	CACHE: KVNamespace;
};

type ProxyCacheEnv = {
	Bindings: Bindings;
};

type ICacheObject = {
	data: any;
	status: number;
	timestamp: number;
};

const app = new Hono<ProxyCacheEnv>();

app.use('*', cors());

// Default TTL if not provided (1 hour in seconds)
const DEFAULT_TTL = 3600;

// Helper function to get data from cache
async function getFromCache(cacheName: string, cache: KVNamespace): Promise<Response | null> {
	const cachedData: ICacheObject | null = await cache.get(cacheName, 'json');
	if (!cachedData) return null;

	return new Response(JSON.stringify(cachedData.data), {
		headers: {
			'Content-Type': 'application/json',
			'X-Cache-Hit': 'true',
			'X-Cache-Name': cacheName,
			'X-Cache-Date': new Date(cachedData.timestamp).toISOString(),
		},
		status: cachedData.status,
	});
}

// Helper function to store data in cache
async function storeInCache(cacheName: string, data: any, status: number, ttl: number, cache: KVNamespace): Promise<void> {
	const cacheObject = {
		data,
		status,
		timestamp: Date.now(),
	};

	await cache.put(cacheName, JSON.stringify(cacheObject), { expirationTtl: ttl });
}

// Middleware to handle both GET and POST requests
app.all('*', async (c) => {
	// Extract cache control headers
	const cacheName = c.req.header('x-cache-name');
	const cacheTtlHeader = c.req.header('x-cache-ttl');
	const cacheTtl = cacheTtlHeader ? parseInt(cacheTtlHeader) : DEFAULT_TTL;

	// Get target URL from query parameters
	const targetUrl = c.req.query('url');

	if (!targetUrl) {
		return c.json({ error: 'No URL provided' }, 400);
	}

	// If cache name is provided and ttl is 0, remove from cache
	if (cacheName && cacheTtl === 0) {
		await c.env.CACHE.delete(cacheName);
		return c.json(
			{
				message: 'Cache cleared successfully',
				cacheName,
			},
			200
		);
	}

	// If cache name is provided, try to get from cache first
	if (cacheName) {
		const cachedResponse = await getFromCache(cacheName, c.env.CACHE);
		if (cachedResponse) {
			return cachedResponse;
		}
	}

	console.log('============raaaaaw', c.req.raw.headers);

	// Prepare headers to forward
	const headers = new Headers();
	for (const [key, value] of c.req.raw.headers.entries()) {
		// Skip cache control headers when forwarding
		if (!key.toLowerCase().startsWith('x-cache-')) {
			headers.set(key, value);
		}
	}

	let requestInit: AxiosRequestConfig = {};

	try {
		// Forward the request
		requestInit = {
			method: c.req.method,
			headers: {
				...headers,
			},
			url: targetUrl,
		};

		// Add body for non-GET requests
		if (c.req.method !== 'GET') {
			const contentType = c.req.header('content-type');
			if (contentType) {
				const data = await c.req.raw.clone().text();
				requestInit.data = data;
			}
		}

		// Fetch from target URL
		const response = await axios(requestInit);

		// Check if response is valid
		if (!response.statusText) {
			return c.json(
				{
					error: 'Error fetching from target URL',
					status: response.status,
					statusText: response.statusText,
				},
				response.status as ContentfulStatusCode
			);
		}

		// Process response
		const responseData = response.data;

		// Store in cache if cache name is provided
		if (cacheName && cacheTtl > 0) {
			await storeInCache(cacheName, responseData, response.status, cacheTtl, c.env.CACHE);
		}

		// Return response with cache info
		const responseHeaders = {
			'Content-Type': 'application/json',
			'X-Proxy-Status': 'success',
			'X-Target-URL': targetUrl,
		} as Record<string, string>;

		if (cacheName) {
			responseHeaders['X-Cache-Hit'] = 'false';
			responseHeaders['X-Cache-Name'] = cacheName;
			responseHeaders['X-Cache-TTL'] = cacheTtl.toString();
		}

		responseHeaders['Access-Control-Allow-Origin'] = '*';
		responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
		responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';

		return c.json(responseData as Record<string, unknown>, response.status as ContentfulStatusCode, responseHeaders);
	} catch (error) {
		console.error(error);
		return c.json(
			{
				error: 'Proxy error',
				message: error instanceof Error ? error.message : 'Unknown error',
				targetUrl,
				details: error,
				requestInit,
			},
			500
		);
	}
});

export default app;

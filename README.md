# Cloudflare Proxy Worker

A high-performance Cloudflare Worker built with Hono that provides intelligent HTTP request proxying with KV-based caching. Features configurable TTL via headers, support for both GET and POST requests, and simple cache invalidation.
Features

🔄 Proxies both GET and POST requests to target URLs

📦 Supports request and response body passthrough

🔒 Securely forwards request headers

💾 Configurable KV-based response caching via x-cache-name header

⏱️ Adjustable cache TTL via x-cache-ttl header (defaults to 1 hour)

🧹 Simple cache invalidation by setting x-cache-ttl: 0

🛡️ Built with TypeScript for type safety

⚡ Powered by Hono framework for maximum performance

# Cloudflare Proxy Worker Documentation

## Overview

The Cloudflare Proxy Worker is a high-performance HTTP proxy implementation built using Cloudflare Workers and the Hono framework. It allows proxying of both GET and POST requests to target URLs while providing robust KV-based caching functionality.

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed (`npm install -g wrangler`)
- Node.js and npm

### Installation

1. Clone the repository:

```bash
git clone https://github.com/tusko/cloudflare-proxy-worker.git
cd cloudflare-proxy-worker
```

2. Install dependencies:

```bash
yarn install
```

3. Create a KV namespace for caching:

```bash
wrangler kv:namespace create "CACHE"
```

4. Add the KV namespace to your `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "CACHE", id = "your-namespace-id" }
]
```

5. Deploy to Cloudflare:

```bash
wrangler publish
```

## Usage

### Basic Proxying

To proxy a request without caching, simply provide the target URL as a query parameter:

```
https://your-worker.workers.dev?url=https://api.example.com/endpoint
```

### Caching Requests

To enable caching, provide the `x-cache-name` header with your request:

```bash
curl -H "x-cache-name: my-resource" "https://your-worker.workers.dev?url=https://api.example.com/endpoint"
```

### Setting Cache TTL

Set a custom TTL (Time To Live) for cached resources using the `x-cache-ttl` header (in seconds):

```bash
curl -H "x-cache-name: my-resource" -H "x-cache-ttl: 300" "https://your-worker.workers.dev?url=https://api.example.com/endpoint"
```

If no TTL is provided, the default is 1 hour (3600 seconds).

### Invalidating Cache

To remove a resource from the cache, set the TTL to 0:

```bash
curl -H "x-cache-name: my-resource" -H "x-cache-ttl: 0" "https://your-worker.workers.dev?url=https://api.example.com/endpoint"
```

### POST Requests

The worker supports proxying POST requests with their bodies intact:

```bash
curl -X POST -H "Content-Type: application/json" -H "x-cache-name: my-post" -d '{"key":"value"}' "https://your-worker.workers.dev?url=https://api.example.com/post-endpoint"
```

## Response Headers

When using the proxy, the following additional headers are included in the response:

| Header           | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `X-Cache-Hit`    | `true` if the response was served from cache, `false` otherwise   |
| `X-Cache-Name`   | The name of the cache entry (if provided)                         |
| `X-Cache-Date`   | The timestamp when the response was cached (if served from cache) |
| `X-Cache-TTL`    | The TTL for the cache entry (if a new entry was created)          |
| `X-Proxy-Status` | Status of the proxy operation                                     |
| `X-Target-URL`   | The URL that was proxied                                          |

## Error Handling

The worker provides descriptive error responses in JSON format:

```json
{
	"error": "Error type",
	"message": "Detailed error message",
	"targetUrl": "The URL that was being proxied"
}
```

Common error scenarios:

- Missing URL parameter
- Network errors
- Target URL returning error status codes

## Advanced Configuration

### Customizing Default TTL

The default TTL is set to 3600 seconds (1 hour). To modify this, change the `DEFAULT_TTL` constant in the code.

### Adding Additional Headers

You can modify the `headers` creation in the code to include additional headers when proxying requests.

## Limitations

- The worker currently only supports JSON responses for caching
- Maximum KV entry size is 25 MB (Cloudflare limitation)
- KV operations count towards your Cloudflare Workers usage limits

## Development

### Local Testing

Run the worker locally using Wrangler:

```bash
wrangler dev
```

### Testing Cache Operations

To test cache operations locally, you'll need to use the `--local` flag with Wrangler to simulate KV operations:

```bash
wrangler dev --local
```

## Troubleshooting

### Common Issues

1. **"Failed to fetch"**: Check if the target URL is accessible and correctly formatted.
2. **"KV access error"**: Verify your KV namespace is correctly configured in `wrangler.toml`.
3. **"Request body stream already read"**: Make sure you're using `.clone()` when accessing the request body multiple times.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

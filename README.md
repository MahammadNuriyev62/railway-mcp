# Railway MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for the [Railway](https://railway.com) platform, hosted on Cloudflare Workers.

Connect it to Claude, Cursor, or any MCP-compatible client by simply adding the URL — no local setup required.

## Quick Start

### Use the hosted version

Add this URL as a remote MCP server in your client:

```
https://railway-mcp.<your-subdomain>.workers.dev/mcp
```

When prompted for authentication, paste your Railway API token as the OAuth client secret.

Generate a token at: https://railway.com/account/tokens

### Deploy your own

1. Clone and install:
   ```bash
   git clone https://github.com/YOUR_USERNAME/railway-mcp.git
   cd railway-mcp
   npm install
   ```

2. (Optional) Set a default Railway token:
   ```bash
   npx wrangler secret put RAILWAY_API_TOKEN
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Available Tools

### Read-only
| Tool | Description |
|------|-------------|
| `me` | Get authenticated user profile |
| `list_projects` | List all projects |
| `get_project` | Get project details (services, environments, volumes) |
| `list_services` | List services in a project |
| `get_service` | Get service details |
| `get_service_instance` | Get service instance config (start command, replicas, etc.) |
| `list_environments` | List environments in a project |
| `list_deployments` | List recent deployments |
| `get_deployment` | Get deployment details |
| `get_build_logs` | Get build logs for a deployment |
| `get_deploy_logs` | Get runtime logs for a deployment |
| `list_variables` | List environment variables |
| `list_domains` | List service and custom domains |
| `list_tcp_proxies` | List TCP proxies |

### Write
| Tool | Description |
|------|-------------|
| `deploy_service` | Trigger a new deployment |
| `restart_deployment` | Restart a deployment |
| `redeploy` | Redeploy a specific deployment |
| `rollback_deployment` | Rollback to a previous deployment |
| `stop_deployment` | Stop a running deployment |
| `variable_upsert` | Create or update an environment variable |
| `variable_delete` | Delete an environment variable |
| `service_domain_create` | Create a Railway-generated domain |
| `custom_domain_create` | Add a custom domain |
| `service_create` | Create a new service |
| `service_delete` | Delete a service |
| `project_create` | Create a new project |
| `project_delete` | Delete a project |
| `environment_create` | Create a new environment |
| `volume_create` | Create a persistent volume |
| `service_instance_update` | Update service settings |

## Authentication

The server uses an OAuth PAT pass-through — your Railway API token is passed through the OAuth flow as a Bearer token. No real OAuth app is needed. The token is never stored on the server.

## Development

```bash
# Local dev server
npm run dev

# Type check
npm run typecheck

# Deploy to Cloudflare
npm run deploy
```

Create a `.dev.vars` file with your Railway token for local development:
```
RAILWAY_API_TOKEN=your-token-here
```

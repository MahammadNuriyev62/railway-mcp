# Railway MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server for the [Railway](https://railway.com) platform, hosted on Cloudflare Workers.

Connect it to Claude, Cursor, or any MCP-compatible client by simply adding the URL. No local setup required.

## Quick Start

Add this URL as a remote MCP server in Claude, Cursor, or any MCP client:

```
https://railway-mcp.maganuriyev.workers.dev/mcp
```

When prompted for authentication, enter your Railway API token. Generate one at: https://railway.com/account/tokens

That's it. No local setup, no installation.

### Deploy your own

If you want to self-host:

1. Clone and install:
   ```bash
   git clone https://github.com/MahammadNuriyev62/railway-mcp.git
   cd railway-mcp
   npm install
   ```

2. Deploy:
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

The server uses an OAuth PAT pass-through. Your Railway API token is passed through the OAuth flow as a Bearer token. No real OAuth app is needed. The token is never stored on the server.

## Development

```bash
# Local dev server
npm run dev

# Type check
npm run typecheck

# Deploy to Cloudflare
npm run deploy
```

For local development, create a `.dev.vars` file so tools can call the Railway API:
```
RAILWAY_API_TOKEN=<your-railway-token>
```

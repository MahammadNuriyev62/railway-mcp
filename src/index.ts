import { createMcpHandler } from "agents/mcp";
import { createServer } from "./server.js";
import {
  handleRegister,
  handleToken,
  oauthMetadata,
  protectedResourceMetadata,
} from "./auth.js";

interface Env {
  RAILWAY_API_TOKEN?: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function corsJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function resolveRailwayToken(
  request: Request,
  env: Env,
): string | undefined {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return env.RAILWAY_API_TOKEN;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const baseUrl = url.origin;

    switch (url.pathname) {
      case "/.well-known/oauth-authorization-server":
        return corsJson(oauthMetadata(baseUrl));

      case "/.well-known/oauth-protected-resource":
        return corsJson(protectedResourceMetadata(baseUrl));

      case "/register":
        return handleRegister();

      case "/token":
        return handleToken(request);

      case "/mcp": {
        const token = resolveRailwayToken(request, env);
        const server = createServer(token);
        const handler = createMcpHandler(server);
        const response = await handler(request, env, ctx);
        // Add CORS headers to the MCP response
        const newHeaders = new Headers(response.headers);
        for (const [k, v] of Object.entries(CORS_HEADERS)) {
          newHeaders.set(k, v);
        }
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }

      default:
        return new Response(
          [
            "Railway MCP Server",
            "",
            "This is a Model Context Protocol server for the Railway platform.",
            "Connect it to Claude or any MCP-compatible client.",
            "",
            `MCP endpoint: ${baseUrl}/mcp`,
            "",
            "To authenticate, provide your Railway API token via OAuth setup.",
            "Generate a token at: https://railway.com/account/tokens",
          ].join("\n"),
          {
            headers: { "Content-Type": "text/plain", ...CORS_HEADERS },
          },
        );
    }
  },
} satisfies ExportedHandler<Env>;

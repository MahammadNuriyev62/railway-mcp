/**
 * OAuth PAT pass-through authentication for Railway MCP server.
 *
 * Uses the same pattern as the GitHub MCP worker: the user pastes their
 * Railway API token into the OAuth "client secret" field, and it gets
 * shuttled through as a Bearer token. No real OAuth flow is needed.
 */

export interface OAuthMetadata {
  issuer: string;
  token_endpoint: string;
  registration_endpoint: string;
  token_endpoint_auth_methods_supported: string[];
  grant_types_supported: string[];
  response_types_supported: string[];
  scopes_supported: string[];
  code_challenge_methods_supported: string[];
}

export function oauthMetadata(baseUrl: string): OAuthMetadata {
  return {
    issuer: baseUrl,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    grant_types_supported: [
      "client_credentials",
      "authorization_code",
      "refresh_token",
    ],
    response_types_supported: ["code"],
    scopes_supported: ["all"],
    code_challenge_methods_supported: ["S256"],
  };
}

export function protectedResourceMetadata(baseUrl: string) {
  return {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    bearer_methods_supported: ["header"],
    scopes_supported: ["all"],
  };
}

export function handleRegister(): Response {
  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomUUID();
  return Response.json({
    client_id: clientId,
    client_secret: clientSecret,
    grant_types: [
      "client_credentials",
      "authorization_code",
      "refresh_token",
    ],
    token_endpoint_auth_method: "client_secret_post",
    redirect_uris: [],
    response_types: ["code"],
  });
}

export async function handleToken(request: Request): Promise<Response> {
  let params: URLSearchParams;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await request.json()) as Record<string, string>;
    params = new URLSearchParams(body);
  } else {
    params = new URLSearchParams(await request.text());
  }

  const grantType = params.get("grant_type");
  let token: string | null = null;

  if (grantType === "client_credentials") {
    // PAT is passed as client_secret
    token = params.get("client_secret");
    if (!token) {
      // Try Basic auth header
      const authHeader = request.headers.get("authorization") ?? "";
      if (authHeader.startsWith("Basic ")) {
        const decoded = atob(authHeader.slice(6));
        const colonIdx = decoded.indexOf(":");
        if (colonIdx !== -1) {
          token = decoded.slice(colonIdx + 1);
        }
      }
    }
  } else if (grantType === "authorization_code") {
    token = params.get("client_secret") ?? params.get("code");
  } else if (grantType === "refresh_token") {
    token = params.get("refresh_token");
  }

  if (!token) {
    return Response.json(
      { error: "invalid_request", error_description: "No token provided" },
      { status: 400 },
    );
  }

  return Response.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 86400,
    refresh_token: token,
    scope: "all",
  });
}

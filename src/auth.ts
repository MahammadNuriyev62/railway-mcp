/**
 * OAuth authorization_code + PKCE pass-through for Railway MCP server.
 *
 * Claude uses the authorization_code grant with PKCE. The flow is:
 * 1. Claude redirects user to /authorize
 * 2. User sees a form, pastes their Railway API token, submits
 * 3. Server redirects back to Claude's callback with code=<token>
 * 4. Claude exchanges the code at /token for an access_token
 * 5. Claude sends Authorization: Bearer <token> on all /mcp requests
 */

export function oauthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    grant_types_supported: ["authorization_code", "refresh_token"],
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

export function handleRegister(request: Request): Response {
  const clientId = crypto.randomUUID();
  return Response.json({
    client_id: clientId,
    grant_types: ["authorization_code", "refresh_token"],
    token_endpoint_auth_method: "none",
    redirect_uris: [],
    response_types: ["code"],
  });
}

export async function handleAuthorize(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const redirectUri = url.searchParams.get("redirect_uri") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const codeChallenge = url.searchParams.get("code_challenge") ?? "";
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "";
    const clientId = url.searchParams.get("client_id") ?? "";
    const scope = url.searchParams.get("scope") ?? "";

    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Railway MCP - Authorize</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #888; margin-bottom: 1.5rem; }
    a { color: #a78bfa; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; }
    input[type="password"] { width: 100%; padding: 0.625rem; border-radius: 6px; border: 1px solid #444; background: #111; color: #fff; font-size: 0.875rem; margin-bottom: 1rem; }
    input[type="password"]:focus { outline: none; border-color: #a78bfa; }
    button { width: 100%; padding: 0.625rem; border-radius: 6px; border: none; background: #a78bfa; color: #000; font-weight: 600; font-size: 0.875rem; cursor: pointer; }
    button:hover { background: #8b5cf6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Railway MCP Server</h1>
    <p>Enter your Railway API token to authorize access.<br>Get one at <a href="https://railway.com/account/tokens" target="_blank">railway.com/account/tokens</a></p>
    <form method="POST">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
      <input type="hidden" name="client_id" value="${escapeHtml(clientId)}">
      <input type="hidden" name="scope" value="${escapeHtml(scope)}">
      <label for="token">API Token</label>
      <input type="password" id="token" name="token" placeholder="your-railway-api-token" required autofocus>
      <button type="submit">Authorize</button>
    </form>
  </div>
</body>
</html>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  // POST: form submitted with token
  return await handleAuthorizePost(request);
}

async function handleAuthorizePost(request: Request): Promise<Response> {
  const body = new URLSearchParams(await request.text());
  const token = body.get("token") ?? "";
  const redirectUri = body.get("redirect_uri") ?? "";
  const state = body.get("state") ?? "";

  if (!token || !redirectUri) {
    return new Response("Missing token or redirect_uri", { status: 400 });
  }

  // Use the token itself as the authorization code.
  // It will be exchanged at /token and returned as access_token.
  const code = btoa(token);

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);

  return Response.redirect(redirect.toString(), 302);
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

  if (grantType === "authorization_code") {
    const code = params.get("code");
    if (code) {
      try {
        token = atob(code);
      } catch {
        token = code;
      }
    }
  } else if (grantType === "refresh_token") {
    const rt = params.get("refresh_token");
    if (rt) {
      try {
        token = atob(rt);
      } catch {
        token = rt;
      }
    }
  }

  if (!token) {
    return Response.json(
      { error: "invalid_request", error_description: "No token provided" },
      { status: 400 },
    );
  }

  const encoded = btoa(token);
  return Response.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 86400,
    refresh_token: encoded,
    scope: "all",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

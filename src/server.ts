import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const RAILWAY_API = "https://backboard.railway.com/graphql/v2";

async function railwayQuery(
  query: string,
  variables: Record<string, unknown>,
  token: string,
): Promise<unknown> {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Railway API error ${res.status}: ${text}`);
  }
  const json = (await res.json()) as {
    data?: unknown;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(
      `Railway GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  return json.data;
}

function text(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function createServer(token?: string): McpServer {
  const server = new McpServer({
    name: "Railway MCP",
    version: "1.0.0",
  });

  function getToken(pat?: string): string {
    const t = pat ?? token;
    if (!t) throw new Error("No Railway API token provided");
    return t;
  }

  // ─── Read-only tools ───────────────────────────────────────────────

  server.tool(
    "me",
    "Get the authenticated Railway user's profile",
    {},
    { readOnlyHint: true, destructiveHint: false },
    async (_args, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(`query { me { id name email } }`, {}, getToken(pat));
      return text(data);
    },
  );

  server.tool(
    "list_projects",
    "List all projects accessible to the authenticated user",
    {},
    { readOnlyHint: true, destructiveHint: false },
    async (_args, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query {
          projects {
            edges {
              node {
                id name description createdAt updatedAt
              }
            }
          }
        }`,
        {},
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_project",
    "Get details for a specific Railway project",
    { projectId: z.string().describe("The project ID") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($id: String!) {
          project(id: $id) {
            id name description createdAt updatedAt
            environments { edges { node { id name } } }
            services { edges { node { id name icon } } }
            volumes { edges { node { id name } } }
          }
        }`,
        { id: projectId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "list_services",
    "List all services in a Railway project",
    { projectId: z.string().describe("The project ID") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($id: String!) {
          project(id: $id) {
            services {
              edges {
                node {
                  id name icon createdAt updatedAt
                }
              }
            }
          }
        }`,
        { id: projectId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_service",
    "Get details for a specific Railway service",
    { serviceId: z.string().describe("The service ID") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ serviceId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($id: String!) {
          service(id: $id) {
            id name icon createdAt updatedAt projectId
          }
        }`,
        { id: serviceId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_service_instance",
    "Get service instance details for a service in a specific environment",
    {
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ serviceId, environmentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($serviceId: String!, $environmentId: String!) {
          serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
            id serviceName startCommand buildCommand rootDirectory
            healthcheckPath region numReplicas restartPolicyType
            cronSchedule sleepApplication
            latestDeployment { id status createdAt }
          }
        }`,
        { serviceId, environmentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "list_environments",
    "List all environments in a Railway project",
    { projectId: z.string().describe("The project ID") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($projectId: String!) {
          environments(projectId: $projectId) {
            edges {
              node { id name createdAt }
            }
          }
        }`,
        { projectId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "list_deployments",
    "List recent deployments for a service in an environment",
    {
      projectId: z.string().describe("The project ID"),
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
      first: z.number().optional().default(10).describe("Number of deployments to fetch (default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId, serviceId, environmentId, first }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($input: DeploymentListInput!, $first: Int) {
          deployments(input: $input, first: $first) {
            edges {
              node {
                id status createdAt url staticUrl
                meta { repo branch commitMessage }
              }
            }
          }
        }`,
        {
          input: { projectId, serviceId, environmentId },
          first,
        },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_deployment",
    "Get details for a specific deployment",
    { deploymentId: z.string().describe("The deployment ID") },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deploymentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($id: String!) {
          deployment(id: $id) {
            id status createdAt url staticUrl
            canRedeploy canRollback
            meta { repo branch commitMessage commitHash image }
          }
        }`,
        { id: deploymentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_build_logs",
    "Get build logs for a deployment",
    {
      deploymentId: z.string().describe("The deployment ID"),
      limit: z.number().optional().default(100).describe("Max number of log lines"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deploymentId, limit }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($deploymentId: String!, $limit: Int) {
          buildLogs(deploymentId: $deploymentId, limit: $limit) {
            timestamp message severity
          }
        }`,
        { deploymentId, limit },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "get_deploy_logs",
    "Get runtime/deploy logs for a deployment",
    {
      deploymentId: z.string().describe("The deployment ID"),
      limit: z.number().optional().default(100).describe("Max number of log lines"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ deploymentId, limit }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($deploymentId: String!, $limit: Int) {
          deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
            timestamp message severity
          }
        }`,
        { deploymentId, limit },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "list_variables",
    "List environment variables for a service in an environment",
    {
      projectId: z.string().describe("The project ID"),
      environmentId: z.string().describe("The environment ID"),
      serviceId: z.string().optional().describe("The service ID (omit for shared variables)"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId, environmentId, serviceId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const vars: Record<string, unknown> = { projectId, environmentId };
      let query: string;
      if (serviceId) {
        vars.serviceId = serviceId;
        query = `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
          variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
        }`;
      } else {
        query = `query($projectId: String!, $environmentId: String!) {
          variables(projectId: $projectId, environmentId: $environmentId)
        }`;
      }
      const data = await railwayQuery(query, vars, getToken(pat));
      return text(data);
    },
  );

  server.tool(
    "list_domains",
    "List domains (service + custom) for a service in an environment",
    {
      projectId: z.string().describe("The project ID"),
      environmentId: z.string().describe("The environment ID"),
      serviceId: z.string().describe("The service ID"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ projectId, environmentId, serviceId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
          domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
            serviceDomains { id domain suffix targetPort }
            customDomains { id domain status { dnsRecords { type hostlabel value } certificateStatus } }
          }
        }`,
        { projectId, environmentId, serviceId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "list_tcp_proxies",
    "List TCP proxies for a service in an environment",
    {
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
    },
    { readOnlyHint: true, destructiveHint: false },
    async ({ serviceId, environmentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `query($serviceId: String!, $environmentId: String!) {
          tcpProxies(serviceId: $serviceId, environmentId: $environmentId) {
            id domain proxyPort applicationPort
          }
        }`,
        { serviceId, environmentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  // ─── Write tools ───────────────────────────────────────────────────

  server.tool(
    "deploy_service",
    "Trigger a new deployment for a service in an environment",
    {
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ serviceId, environmentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($serviceId: String!, $environmentId: String!) {
          serviceInstanceDeployV2(serviceId: $serviceId, environmentId: $environmentId)
        }`,
        { serviceId, environmentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "restart_deployment",
    "Restart an existing deployment",
    { deploymentId: z.string().describe("The deployment ID") },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deploymentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          deploymentRestart(id: $id)
        }`,
        { id: deploymentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "redeploy",
    "Redeploy a specific deployment",
    { deploymentId: z.string().describe("The deployment ID") },
    { readOnlyHint: false, destructiveHint: false },
    async ({ deploymentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          deploymentRedeploy(id: $id) { id status }
        }`,
        { id: deploymentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "rollback_deployment",
    "Rollback to a specific deployment",
    { deploymentId: z.string().describe("The deployment ID to rollback to") },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deploymentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          deploymentRollback(id: $id) { id status }
        }`,
        { id: deploymentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "stop_deployment",
    "Stop a running deployment",
    { deploymentId: z.string().describe("The deployment ID") },
    { readOnlyHint: false, destructiveHint: true },
    async ({ deploymentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          deploymentStop(id: $id)
        }`,
        { id: deploymentId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "variable_upsert",
    "Create or update an environment variable",
    {
      projectId: z.string().describe("The project ID"),
      environmentId: z.string().describe("The environment ID"),
      serviceId: z.string().optional().describe("The service ID (omit for shared variables)"),
      name: z.string().describe("Variable name"),
      value: z.string().describe("Variable value"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ projectId, environmentId, serviceId, name, value }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = {
        projectId,
        environmentId,
        name,
        value,
      };
      if (serviceId) input.serviceId = serviceId;
      const data = await railwayQuery(
        `mutation($input: VariableUpsertInput!) {
          variableUpsert(input: $input)
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "variable_delete",
    "Delete an environment variable",
    {
      projectId: z.string().describe("The project ID"),
      environmentId: z.string().describe("The environment ID"),
      serviceId: z.string().optional().describe("The service ID (omit for shared variables)"),
      name: z.string().describe("Variable name to delete"),
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ projectId, environmentId, serviceId, name }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = { projectId, environmentId, name };
      if (serviceId) input.serviceId = serviceId;
      const data = await railwayQuery(
        `mutation($input: VariableDeleteInput!) {
          variableDelete(input: $input)
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "service_domain_create",
    "Create a Railway-generated domain for a service",
    {
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
      targetPort: z.number().optional().describe("Port to route traffic to"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ serviceId, environmentId, targetPort }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = { serviceId, environmentId };
      if (targetPort !== undefined) input.targetPort = targetPort;
      const data = await railwayQuery(
        `mutation($input: ServiceDomainCreateInput!) {
          serviceDomainCreate(input: $input) { id domain }
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "custom_domain_create",
    "Add a custom domain to a service",
    {
      projectId: z.string().describe("The project ID"),
      environmentId: z.string().describe("The environment ID"),
      serviceId: z.string().describe("The service ID"),
      domain: z.string().describe("The custom domain (e.g. api.example.com)"),
      targetPort: z.number().optional().describe("Port to route traffic to"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ projectId, environmentId, serviceId, domain, targetPort }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = {
        projectId,
        environmentId,
        serviceId,
        domain,
      };
      if (targetPort !== undefined) input.targetPort = targetPort;
      const data = await railwayQuery(
        `mutation($input: CustomDomainCreateInput!) {
          customDomainCreate(input: $input) {
            id domain
            status { dnsRecords { type hostlabel value } }
          }
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "service_create",
    "Create a new service in a project",
    {
      projectId: z.string().describe("The project ID"),
      name: z.string().describe("Service name"),
      repo: z.string().optional().describe("GitHub repo to connect (owner/repo format)"),
      branch: z.string().optional().describe("Branch to deploy from"),
      image: z.string().optional().describe("Docker image to deploy"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ projectId, name, repo, branch, image }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = { projectId, name };
      if (repo || image) {
        const source: Record<string, string> = {};
        if (repo) source.repo = repo;
        if (image) source.image = image;
        input.source = source;
      }
      if (branch) input.branch = branch;
      const data = await railwayQuery(
        `mutation($input: ServiceCreateInput!) {
          serviceCreate(input: $input) { id name }
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "service_delete",
    "Delete a service (irreversible!)",
    { serviceId: z.string().describe("The service ID to delete") },
    { readOnlyHint: false, destructiveHint: true },
    async ({ serviceId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          serviceDelete(id: $id)
        }`,
        { id: serviceId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "project_create",
    "Create a new Railway project",
    {
      name: z.string().describe("Project name"),
      description: z.string().optional().describe("Project description"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ name, description }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = { name };
      if (description) input.description = description;
      const data = await railwayQuery(
        `mutation($input: ProjectCreateInput!) {
          projectCreate(input: $input) { id name }
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "project_delete",
    "Delete a Railway project (irreversible!)",
    { projectId: z.string().describe("The project ID to delete") },
    { readOnlyHint: false, destructiveHint: true },
    async ({ projectId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($id: String!) {
          projectDelete(id: $id)
        }`,
        { id: projectId },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "environment_create",
    "Create a new environment in a project",
    {
      projectId: z.string().describe("The project ID"),
      name: z.string().describe("Environment name"),
      sourceEnvironmentId: z.string().optional().describe("Environment ID to copy from"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ projectId, name, sourceEnvironmentId }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const input: Record<string, unknown> = { projectId, name };
      if (sourceEnvironmentId) input.sourceEnvironmentId = sourceEnvironmentId;
      const data = await railwayQuery(
        `mutation($input: EnvironmentCreateInput!) {
          environmentCreate(input: $input) { id name }
        }`,
        { input },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "volume_create",
    "Create a persistent volume attached to a service",
    {
      projectId: z.string().describe("The project ID"),
      serviceId: z.string().describe("The service ID to attach the volume to"),
      mountPath: z.string().describe("Mount path inside the container (e.g. /data)"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ projectId, serviceId, mountPath }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      const data = await railwayQuery(
        `mutation($input: VolumeCreateInput!) {
          volumeCreate(input: $input) { id name }
        }`,
        { input: { projectId, serviceId, mountPath } },
        getToken(pat),
      );
      return text(data);
    },
  );

  server.tool(
    "service_instance_update",
    "Update service instance settings (start command, build command, replicas, etc.)",
    {
      serviceId: z.string().describe("The service ID"),
      environmentId: z.string().describe("The environment ID"),
      startCommand: z.string().optional().describe("Start command"),
      buildCommand: z.string().optional().describe("Build command"),
      rootDirectory: z.string().optional().describe("Root directory"),
      healthcheckPath: z.string().optional().describe("Health check path"),
      numReplicas: z.number().optional().describe("Number of replicas"),
      region: z.string().optional().describe("Deployment region"),
      cronSchedule: z.string().optional().describe("Cron schedule (for cron jobs)"),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ serviceId, environmentId, ...settings }, extra) => {
      const pat = (extra as any)?._meta?.pat;
      // Filter out undefined values
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(settings)) {
        if (v !== undefined) input[k] = v;
      }
      const data = await railwayQuery(
        `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
          serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
        }`,
        { serviceId, environmentId, input },
        getToken(pat),
      );
      return text(data);
    },
  );

  return server;
}

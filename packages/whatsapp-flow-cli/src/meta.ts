import { FlowCompileError } from "whatsapp-flow-core";
import type { FlowsAppConfig } from "whatsapp-flow-tsx";

// Mirrors the proven Graph API interaction in the whatsapp-flow-crud skill.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH_BASE = process.env.WHATSAPP_API_URL || "https://graph.facebook.com";

export interface MetaFlow {
  id: string;
  name?: string;
  status?: string;
}

/** Resolve the Graph API access token from the configured env var. */
export function getToken(app: FlowsAppConfig): string {
  const envName = app.tokenEnv ?? "WHATSAPP_ACCESS_TOKEN";
  const token = process.env[envName]?.trim();
  if (!token) {
    throw new FlowCompileError(
      `${envName} is not set. Export it, or run via your env loader, e.g.\n` +
        `  dotenvx run -f .env.local -- pnpm flows push`,
    );
  }
  return token;
}

interface GraphOptions {
  method?: string;
  query?: Record<string, string | undefined>;
  body?: unknown;
  formData?: FormData;
}

async function graph(apiPath: string, token: string, options: GraphOptions = {}): Promise<unknown> {
  const url = new URL(`${GRAPH_BASE}/${GRAPH_VERSION}/${apiPath}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | FormData | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  } else if (options.formData !== undefined) {
    body = options.formData;
  }

  const response = await fetch(url, { method: options.method ?? "GET", headers, body });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const detail = (data as { error?: { message?: string } }).error?.message ?? response.statusText;
    throw new FlowCompileError(
      `Meta ${options.method ?? "GET"} ${url.pathname} failed (${response.status}): ${detail}`,
    );
  }
  return data;
}

/** Find a flow by exact name on a WABA, or null. */
export async function findFlowByName(
  wabaId: string,
  name: string,
  token: string,
): Promise<MetaFlow | null> {
  const data = (await graph(`${wabaId}/flows`, token, {
    query: { fields: "id,name,status", limit: "200" },
  })) as { data?: MetaFlow[] };
  return (data.data ?? []).find((f) => f.name === name) ?? null;
}

/** Create a draft flow with its JSON inline. Returns the new flow id. */
export async function createFlow(
  wabaId: string,
  args: { name: string; categories?: string[]; flow: unknown },
  token: string,
): Promise<string> {
  const data = (await graph(`${wabaId}/flows`, token, {
    method: "POST",
    body: {
      name: args.name,
      categories: args.categories ?? ["OTHER"],
      flow_json: JSON.stringify(args.flow),
    },
  })) as { id?: string };
  if (!data.id) throw new FlowCompileError(`Meta create flow "${args.name}" returned no id.`);
  return data.id;
}

/** Replace an existing flow's JSON via the assets endpoint (multipart). */
export async function uploadFlowJson(flowId: string, flow: unknown, token: string): Promise<void> {
  const form = new FormData();
  form.set("name", "flow.json");
  form.set("asset_type", "FLOW_JSON");
  form.set("file", new Blob([JSON.stringify(flow)], { type: "application/json" }), "flow.json");
  await graph(`${flowId}/assets`, token, { method: "POST", formData: form });
}

/** Publish a flow (irreversible-ish: a published flow can't be deleted). */
export async function publishFlow(flowId: string, token: string): Promise<void> {
  await graph(`${flowId}/publish`, token, { method: "POST" });
}

// --- message templates -----------------------------------------------------

export interface MetaTemplate {
  id: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
}

/** Find a template by exact name + language on a WABA, or null. */
export async function findTemplateByName(
  wabaId: string,
  name: string,
  language: string,
  token: string,
): Promise<MetaTemplate | null> {
  const data = (await graph(`${wabaId}/message_templates`, token, {
    query: { fields: "id,name,language,status,category", limit: "200" },
  })) as { data?: MetaTemplate[] };
  return (data.data ?? []).find((t) => t.name === name && t.language === language) ?? null;
}

/** Create a message template. Returns its id and (pending) review status. */
export async function createTemplate(
  wabaId: string,
  payload: Record<string, unknown>,
  token: string,
): Promise<{ id: string; status?: string }> {
  const data = (await graph(`${wabaId}/message_templates`, token, {
    method: "POST",
    body: payload,
  })) as { id?: string; status?: string };
  if (!data.id)
    throw new FlowCompileError(`Meta create template "${String(payload.name)}" returned no id.`);
  return { id: data.id, status: data.status };
}

/** Edit an existing template's components in place. Meta only permits this in
 * certain review states (not PENDING); the Graph error is surfaced otherwise. */
export async function editTemplate(
  templateId: string,
  components: unknown[],
  token: string,
): Promise<void> {
  await graph(`${templateId}`, token, { method: "POST", body: { components } });
}

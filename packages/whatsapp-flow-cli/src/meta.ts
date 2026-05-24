import { FlowCompileError } from "whatsapp-flow-core";

// Mirrors the proven Graph API interaction in the whatsapp-flow-crud skill.
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH_BASE = process.env.WHATSAPP_API_URL || "https://graph.facebook.com";

export interface MetaFlow {
  id: string;
  name?: string;
  status?: string;
}

/** Resolve the Graph API access token from WHATSAPP_ACCESS_TOKEN. */
export function getToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new FlowCompileError(
      "WHATSAPP_ACCESS_TOKEN is not set. Export it, or run via your env loader, e.g.\n" +
        "  dotenvx run -f .env.local -- pnpm flows push",
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
    throw new FlowCompileError(formatMetaError(options.method ?? "GET", url, response.status, data));
  }
  return data;
}

interface MetaErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    error_user_title?: string;
    error_user_msg?: string;
    error_data?: unknown;
    fbtrace_id?: string;
  };
}

/** (code, subcode) → actionable hint. Meta returns opaque codes; map the ones
 * we've seen to a one-liner that tells the developer what to actually do. */
const KNOWN_ERRORS: Record<string, string> = {
  // Same-name cooldown: a deleted/approved template name is held for ~4 weeks.
  "100:2388023":
    "Same-name cooldown — rename the template (change the .tsx filename or set `name` in defineTemplate). Meta holds the slot for ~4 weeks after a delete.",
  // Template already exists with the same content — common when adopting a live template.
  "100:2388024":
    "A template with this name+language already exists on Meta. Bump the name, or delete the existing one first.",
  // Generic auth / token issues.
  "190:0":
    "Access token is invalid or expired. Refresh WHATSAPP_ACCESS_TOKEN (System User token preferred).",
};

/** Meta wraps the real failure reason in nested fields; surface them all so the
 * developer doesn't see a useless "Invalid parameter" line. Append a hint when
 * we recognize the (code, subcode) pair. */
function formatMetaError(method: string, url: URL, status: number, data: unknown): string {
  const err = (data as MetaErrorBody).error ?? {};
  const parts: string[] = [];
  parts.push(`Meta ${method} ${url.pathname} failed (${status})`);
  if (err.error_user_title) parts.push(`  ${err.error_user_title}`);
  if (err.error_user_msg) parts.push(`  ${err.error_user_msg}`);
  const codeBits = [
    err.code !== undefined ? `code ${err.code}` : "",
    err.error_subcode !== undefined ? `subcode ${err.error_subcode}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  if (err.message) parts.push(`  ${err.message}${codeBits ? ` (${codeBits})` : ""}`);
  if (err.error_data) parts.push(`  data: ${JSON.stringify(err.error_data)}`);
  if (err.fbtrace_id) parts.push(`  fbtrace_id: ${err.fbtrace_id}`);

  const hint = KNOWN_ERRORS[`${err.code}:${err.error_subcode ?? 0}`];
  if (hint) parts.push(`  → ${hint}`);
  return parts.join("\n");
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

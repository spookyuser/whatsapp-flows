import { FlowCompileError, FlowCompileErrors } from "./errors.ts";
import type { FlowJson } from "./types.ts";
import { verifyFlowJson } from "./verify.ts";

export interface ScreenMeta {
  id: string;
  route: string;
  terminal: boolean;
  completes: boolean;
  edgeCount: number;
}

export interface ValidateOptions {
  screens?: ScreenMeta[];
  start?: string;
}

/** Validate an assembled Flow JSON document. Throws FlowCompileErrors on any
 * failure (including dead-end screens and terminal screens without
 * `<Complete>` — the compiler is strict). Structural conformance is checked
 * formally against the generated JSON Schema (Ajv) via verifyFlowJson. */
export function validateFlow(flow: FlowJson, opts: ValidateOptions = {}): void {
  const errors: FlowCompileError[] = [];
  const metaById = new Map((opts.screens ?? []).map((m) => [m.id, m]));
  const routeOf = (id: string): string => metaById.get(id)?.route ?? id;

  // 1. unique screen ids
  const ids = new Set<string>();
  for (const screen of flow.screens) {
    if (ids.has(screen.id)) {
      errors.push(
        new FlowCompileError(
          `Two screens generate the same id "${screen.id}". Routes must map to unique screen ids.`,
          { route: routeOf(screen.id) },
        ),
      );
    }
    ids.add(screen.id);
  }

  // 2. routing model references must resolve to real screens
  for (const [from, targets] of Object.entries(flow.routing_model)) {
    if (!ids.has(from)) {
      errors.push(
        new FlowCompileError(`routing_model references screen "${from}", which does not exist.`),
      );
    }
    for (const target of targets) {
      if (!ids.has(target)) {
        errors.push(
          new FlowCompileError(
            `Screen "${routeOf(from)}" transitions to "${target}", which does not exist.`,
            { route: routeOf(from) },
          ),
        );
      }
    }
  }

  // 3. start screen must exist
  if (opts.start && !ids.has(opts.start)) {
    errors.push(new FlowCompileError(`Start screen "${opts.start}" does not exist.`));
  }

  // 4. nothing unserializable in the output
  for (const issue of findUnserializable(flow, "")) {
    errors.push(new FlowCompileError(issue));
  }

  // 5. formal JSON Schema conformance (Ajv)
  const verdict = verifyFlowJson(flow);
  if (!verdict.valid) {
    for (const issue of verdict.errors) {
      errors.push(new FlowCompileError(humanizeSchemaIssue(issue, flow, routeOf)));
    }
  }

  // 6. terminal / completion consistency
  for (const meta of opts.screens ?? []) {
    if (meta.completes && !meta.terminal) {
      errors.push(
        new FlowCompileError(
          `Screen "${meta.route}" uses <Complete> but is marked terminal={false}. Completion only belongs on terminal screens.`,
          { route: meta.route },
        ),
      );
    }
    if (meta.terminal && !meta.completes) {
      errors.push(
        new FlowCompileError(`Screen "${meta.route}" is terminal but has no <Complete> action.`, {
          route: meta.route,
        }),
      );
    }
    if (!meta.terminal && meta.edgeCount === 0) {
      errors.push(
        new FlowCompileError(
          `Screen "${meta.route}" is not terminal and has no outgoing <Next>/<Exchange> — it is a dead end.`,
          { route: meta.route },
        ),
      );
    }
  }

  // 7. round-trip
  try {
    const round = JSON.parse(JSON.stringify(flow));
    if (JSON.stringify(round) !== JSON.stringify(flow)) {
      errors.push(
        new FlowCompileError("Flow JSON did not survive a JSON.stringify/parse round-trip."),
      );
    }
  } catch (e) {
    errors.push(new FlowCompileError(`Flow JSON could not be serialized: ${String(e)}`));
  }

  if (errors.length > 0) throw new FlowCompileErrors(errors);
}

function findUnserializable(value: unknown, path: string): string[] {
  const out: string[] = [];
  const t = typeof value;
  if (t === "function")
    out.push(`Value at "${path || "root"}" is a function and cannot be serialized.`);
  else if (t === "symbol")
    out.push(`Value at "${path || "root"}" is a symbol and cannot be serialized.`);
  else if (t === "bigint")
    out.push(`Value at "${path || "root"}" is a bigint and cannot be serialized.`);
  else if (t === "undefined")
    out.push(`Value at "${path || "root"}" is undefined and cannot be serialized.`);
  else if (t === "number" && !Number.isFinite(value as number)) {
    out.push(`Value at "${path || "root"}" is ${String(value)} and cannot be serialized.`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...findUnserializable(v, `${path}[${i}]`)));
  } else if (t === "object" && value !== null) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...findUnserializable(v, path ? `${path}.${k}` : k));
    }
  }
  return out;
}

function humanizeSchemaIssue(
  issue: { instancePath: string; message: string },
  flow: FlowJson,
  routeOf: (id: string) => string,
): string {
  const parts = issue.instancePath.split("/").filter(Boolean);
  if (parts[0] === "screens" && parts[1] !== undefined) {
    const index = Number(parts[1]);
    const screen = flow.screens[index];
    const where = parts.slice(2).join(".");
    const id = screen?.id ?? `#${index}`;
    return `Schema: screen "${routeOf(id)}"${where ? ` → ${where}` : ""} ${issue.message}`;
  }
  return `Schema: ${issue.instancePath || "flow"} ${issue.message}`;
}

import Ajv, { type ValidateFunction } from "ajv";
import { buildFlowJsonSchema } from "./json-schema.ts";
import type { FlowJson } from "./types.ts";

export interface VerifyIssue {
  instancePath: string;
  message: string;
}

export interface VerifyResult {
  valid: boolean;
  errors: VerifyIssue[];
}

let validator: ValidateFunction | undefined;

function getValidator(): ValidateFunction {
  if (!validator) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    validator = ajv.compile(buildFlowJsonSchema());
  }
  return validator;
}

/** Formally verify a Flow JSON document against the generated JSON Schema using
 * Ajv — a validation engine independent of the compiler's builder logic. */
export function verifyFlowJson(flow: unknown): VerifyResult {
  const validate = getValidator();
  const ok = validate(flow) as boolean;
  if (ok) return { valid: true, errors: [] };

  const seen = new Set<string>();
  const errors: VerifyIssue[] = [];
  for (const e of validate.errors ?? []) {
    // Skip the noisy umbrella "must match exactly one schema in oneOf".
    if (e.keyword === "oneOf") continue;
    const issue = { instancePath: e.instancePath, message: e.message ?? "is invalid" };
    const key = `${issue.instancePath}::${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push(issue);
  }
  return { valid: false, errors };
}

export { buildFlowJsonSchema };
export type { FlowJson };

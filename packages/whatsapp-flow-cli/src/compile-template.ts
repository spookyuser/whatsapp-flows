import { type AuthoringNode, FlowCompileError, isAuthoringNode, textOf } from "whatsapp-flow-core";
import path from "node:path";
import type { FlowsAppConfig, TemplateCategory, TemplateConfig } from "whatsapp-flow-tsx";
import { loadModule } from "./load-module.ts";

/** A compiled message template: the exact payload the Meta
 * `/{WABA}/message_templates` create endpoint accepts, plus metadata. */
export interface CompiledTemplate {
  name: string;
  language: string;
  category: TemplateCategory;
  allowCategoryChange: boolean;
  /** Meta template `components` array (HEADER/BODY/FOOTER/BUTTONS). */
  components: TemplateComponent[];
  /** Full create payload (name, language, category, allow_category_change, components). */
  payload: Record<string, unknown>;
  /** Absolute path to the source .tsx file. */
  file: string;
  /** FLOW buttons that reference a flow in this app by name; their `flow_id` is
   * filled per-env at push time (see `resolveTemplateFlowRefs`). Empty when no
   * `<Template.Flow flowName=…>` is used. */
  flowRefs: FlowRef[];
}

/** An unresolved FLOW-button → in-app flow reference. `button` points into the
 * compiled `components`/`payload`, so setting `button.flow_id` resolves it. */
export interface FlowRef {
  button: TemplateComponent;
  flowName: string;
}

type TemplateComponent = Record<string, unknown>;

const ISSUES_URL = "https://github.com/spookyuser/whatsapp-flows/issues";

const CATEGORIES = new Set<TemplateCategory>(["MARKETING", "UTILITY", "AUTHENTICATION"]);
const NAME_RE = /^[a-z0-9_]+$/;
const SECTION_COMPONENTS = new Set(["Header", "Body", "Footer", "Buttons"]);

/** True when a loaded module is a message template (exports `template`). */
export function isTemplateModule(mod: Record<string, unknown>): boolean {
  const t = mod.template;
  return typeof t === "object" && t !== null;
}

/** Compile a single-file message template: one `.tsx` module that exports
 * `template` (a `defineTemplate({...})` config) and a default function returning
 * `<Template>…</Template>`. Variables (`v(...)`) are numbered `{{1}}`, `{{2}}`…
 * per component, and their examples are gathered into the shape Meta requires. */
export async function compileTemplateFile(
  file: string,
  app: Pick<FlowsAppConfig, "language"> = {},
  preloaded?: Record<string, unknown>,
): Promise<CompiledTemplate> {
  const mod = preloaded ?? (await loadModule(file));
  const cfg = mod.template as TemplateConfig | undefined;
  const base = path.basename(file);
  if (!cfg || typeof cfg !== "object") {
    throw new FlowCompileError(
      `Template "${base}" must export \`template = defineTemplate({ category })\`.`,
    );
  }

  const name = (cfg.name ?? fileToTemplateName(file)).toLowerCase();
  if (!NAME_RE.test(name)) {
    throw new FlowCompileError(
      `Template name "${name}" is invalid — Meta names must be lowercase letters, numbers, and underscores only.`,
    );
  }
  if (!cfg.category || !CATEGORIES.has(cfg.category)) {
    throw new FlowCompileError(
      `Template "${name}" needs a category of MARKETING, UTILITY, or AUTHENTICATION.`,
    );
  }
  const language = cfg.language ?? app.language ?? "en_US";
  const category = cfg.category;
  const allowCategoryChange = cfg.allowCategoryChange ?? false;

  const root = renderRoot(mod, base, name);
  const { header, body, footer, buttons } = collectSections(root.children, name);

  const flowRefs: FlowRef[] = [];
  const components: TemplateComponent[] = [];
  if (header) components.push(buildHeader(header, name));
  components.push(buildBody(body, name));
  if (footer) components.push(buildFooter(footer, name));
  if (buttons) components.push(buildButtons(buttons, name, flowRefs));

  warnMissingOptOut(category, components, name);

  const payload: Record<string, unknown> = {
    name,
    language,
    category,
    allow_category_change: allowCategoryChange,
    components,
  };

  return { name, language, category, allowCategoryChange, components, payload, file, flowRefs };
}

/** Warn when a MARKETING template has no opt-out button: Meta may auto-inject
 * one, so authors who want to control its placement should add `Template.OptOut`. */
function warnMissingOptOut(
  category: TemplateCategory,
  components: TemplateComponent[],
  name: string,
): void {
  if (category !== "MARKETING") return;
  const buttons = components.find((c) => c.type === "BUTTONS")?.buttons as
    | TemplateComponent[]
    | undefined;
  if (buttons?.some((b) => b.type === "MARKETING_OPT_OUT")) return;
  console.warn(
    `⚠ Template "${name}" is MARKETING and has no <Template.OptOut>. Meta may auto-inject an ` +
      "opt-out button; add <Template.OptOut> inside <Template.Buttons> to control its placement.",
  );
}

/** Fill each FLOW button that references an in-app flow by name with the flow's
 * per-env id (from the lockfile's resolved asset map). Mutates the compiled
 * button objects in place. In a dry run, an unresolved name is left unfilled;
 * otherwise it's a hard error (the referenced flow isn't part of this app). */
export function resolveTemplateFlowRefs(
  tpl: CompiledTemplate,
  flowIdByName: Record<string, { id: string } | undefined>,
  opts: { dryRun?: boolean } = {},
): void {
  for (const ref of tpl.flowRefs) {
    const id = flowIdByName[ref.flowName]?.id;
    if (id) {
      ref.button.flow_id = id;
    } else if (!opts.dryRun) {
      throw new FlowCompileError(
        `Template "${tpl.name}" references flow "${ref.flowName}" via ` +
          `<Template.Flow flowName="${ref.flowName}">, but this app has no flow named ` +
          `"${ref.flowName}". Add that flow to the app, or pass a raw flowId for an external flow.`,
      );
    }
  }
}

// --- structure -------------------------------------------------------------

/** Resolve the `<Template>` root from the module: a default export that is a
 * function (called) or a node, falling back to the first PascalCase function. */
function renderRoot(mod: Record<string, unknown>, base: string, name: string): AuthoringNode {
  let value: unknown = mod.default;
  if (value === undefined) {
    const fn = Object.entries(mod).find(
      ([key, val]) => typeof val === "function" && /^[A-Z]/.test(key),
    );
    if (fn) value = fn[1];
  }
  if (typeof value === "function") {
    try {
      value = (value as () => unknown)();
    } catch (e) {
      if (e instanceof FlowCompileError) throw e;
      throw new FlowCompileError(
        `Template "${name}" threw while rendering: ${(e as Error).message}`,
      );
    }
  }
  if (!isAuthoringNode(value) || value.component !== "Template") {
    throw new FlowCompileError(
      `Template "${base}" must \`export default\` a function returning <Template>…</Template>.`,
    );
  }
  return value;
}

interface Sections {
  header?: AuthoringNode;
  body: AuthoringNode;
  footer?: AuthoringNode;
  buttons?: AuthoringNode;
}

function collectSections(children: AuthoringNode[], name: string): Sections {
  const found: Record<string, AuthoringNode[]> = { Header: [], Body: [], Footer: [], Buttons: [] };
  for (const child of children) {
    if (child.component === "#text") {
      if (String(child.props.value ?? "").trim().length > 0) {
        throw new FlowCompileError(
          `Loose text inside <Template> in "${name}" — wrap it in <Template.Body>.`,
        );
      }
      continue;
    }
    if (!SECTION_COMPONENTS.has(child.component)) {
      throw new FlowCompileError(
        `Unexpected <${child.component}> inside <Template> in "${name}". Allowed: Template.Header, Template.Body, Template.Footer, Template.Buttons.`,
      );
    }
    found[child.component]!.push(child);
  }
  if (found.Body!.length !== 1) {
    throw new FlowCompileError(
      `Template "${name}" must have exactly one <Template.Body> (found ${found.Body!.length}).`,
    );
  }
  for (const single of ["Header", "Footer", "Buttons"] as const) {
    if (found[single]!.length > 1) {
      throw new FlowCompileError(
        `Template "${name}" has ${found[single]!.length} <Template.${single}> sections; only one is allowed.`,
      );
    }
  }
  return {
    header: found.Header![0],
    body: found.Body![0]!,
    footer: found.Footer![0],
    buttons: found.Buttons![0],
  };
}

// --- components ------------------------------------------------------------

function buildHeader(n: AuthoringNode, name: string): TemplateComponent {
  const format = (n.props.format as string | undefined) ?? "TEXT";
  if (format === "TEXT") {
    const { text, examples } = renderText(n.children, name, "header");
    if (!text) throw new FlowCompileError(`Header in "${name}" is empty.`);
    if (examples.length > 1) {
      throw new FlowCompileError(
        `Header in "${name}" allows at most one variable (found ${examples.length}).`,
      );
    }
    const comp: TemplateComponent = { type: "HEADER", format: "TEXT", text };
    if (examples.length === 1) comp.example = { header_text: [examples[0]!.example] };
    return comp;
  }
  const handle = n.props.handle as string | undefined;
  if (!handle) {
    throw new FlowCompileError(
      `${format} header in "${name}" needs an example media \`handle\` (upload media to Meta first).`,
    );
  }
  return { type: "HEADER", format, example: { header_handle: [handle] } };
}

function buildBody(n: AuthoringNode, name: string): TemplateComponent {
  const { text, examples } = renderText(n.children, name, "body");
  if (!text) throw new FlowCompileError(`Body in "${name}" is empty.`);
  const comp: TemplateComponent = { type: "BODY", text };
  if (examples.length > 0) comp.example = { body_text: [examples.map((e) => e.example)] };
  return comp;
}

function buildFooter(n: AuthoringNode, name: string): TemplateComponent {
  const { text, examples } = renderText(n.children, name, "footer");
  if (examples.length > 0) {
    throw new FlowCompileError(
      `Footer in "${name}" can't contain variables — Meta footers are static text.`,
    );
  }
  if (!text) throw new FlowCompileError(`Footer in "${name}" is empty.`);
  return { type: "FOOTER", text };
}

function buildButtons(n: AuthoringNode, name: string, flowRefs: FlowRef[]): TemplateComponent {
  const buttonNodes = n.children.filter((c) => c.component !== "#text");
  if (buttonNodes.length === 0) {
    throw new FlowCompileError(`<Template.Buttons> in "${name}" has no buttons.`);
  }
  if (buttonNodes.length > 10) {
    throw new FlowCompileError(
      `Template "${name}" has ${buttonNodes.length} buttons; Meta allows at most 10.`,
    );
  }
  return { type: "BUTTONS", buttons: buttonNodes.map((b) => buildButton(b, name, flowRefs)) };
}

/** Throw the uniform "not implemented yet" error for a stubbed button. The
 * component is exposed for discoverability but compiling it fails. */
function notImplemented(display: string, metaType: string): never {
  throw new FlowCompileError(
    `${display} is not implemented yet. The component is exposed so you can see the full ` +
      "button surface, but compiling it fails. Use <Template.URL> / a different button while " +
      `you wait, or open an issue at ${ISSUES_URL} to bump priority. ` +
      `(Underlying Meta type: ${metaType}.)`,
  );
}

function buildButton(b: AuthoringNode, name: string, flowRefs: FlowRef[]): TemplateComponent {
  switch (b.component) {
    case "QuickReply": {
      const text = (b.props.text as string | undefined) ?? textOf(b);
      if (!text) throw new FlowCompileError(`A quick-reply button in "${name}" needs text.`);
      return { type: "QUICK_REPLY", text };
    }
    case "URLButton": {
      const text = b.props.text as string;
      if (!text) throw new FlowCompileError(`A URL button in "${name}" needs text.`);
      const url = renderUrl(b.props.url, name);
      const comp: TemplateComponent = { type: "URL", text, url: url.text };
      if (url.example !== undefined) comp.example = [url.example];
      return comp;
    }
    case "PhoneButton": {
      const text = b.props.text as string;
      const phone = b.props.phoneNumber as string;
      if (!text || !phone) {
        throw new FlowCompileError(`A phone button in "${name}" needs text and a phoneNumber.`);
      }
      return { type: "PHONE_NUMBER", text, phone_number: phone };
    }
    case "FlowButton": {
      const text = b.props.text as string;
      if (!text) throw new FlowCompileError(`A flow button in "${name}" needs text.`);
      const flowName = b.props.flowName as string | undefined;
      const flowId = b.props.flowId as string | undefined;
      if (!flowName === !flowId) {
        throw new FlowCompileError(
          `A flow button in "${name}" needs exactly one of flowName (a flow in this app) or ` +
            "flowId (a raw Meta flow id).",
        );
      }
      const flowAction = (b.props.flowAction as string | undefined) ?? "navigate";
      const navigateScreen = b.props.navigateScreen as string | undefined;
      if (flowAction === "navigate" && !navigateScreen) {
        throw new FlowCompileError(
          `A flow button in "${name}" with flowAction "navigate" needs a navigateScreen ` +
            "(the id of the first screen to open).",
        );
      }
      const comp: TemplateComponent = { type: "FLOW", text, flow_action: flowAction };
      if (navigateScreen) comp.navigate_screen = navigateScreen;
      if (flowId) comp.flow_id = flowId;
      else flowRefs.push({ button: comp, flowName: flowName! });
      return comp;
    }
    case "CopyCodeButton": {
      const code = b.props.code as string | undefined;
      if (!code) {
        throw new FlowCompileError(
          `A copy-code button in "${name}" needs a code (the example coupon code).`,
        );
      }
      return { type: "COPY_CODE", example: code };
    }
    case "CatalogButton":
      return { type: "CATALOG", text: "View catalog" };
    case "OptOutButton": {
      const text = (b.props.text as string | undefined) ?? "Stop promotions";
      return { type: "MARKETING_OPT_OUT", text };
    }
    case "OtpCopyCodeButton": {
      const comp: TemplateComponent = { type: "OTP", otp_type: "COPY_CODE" };
      const text = b.props.text as string | undefined;
      if (text) comp.text = text;
      return comp;
    }
    case "OtpOneTapButton":
    case "OtpZeroTapButton": {
      const oneTap = b.component === "OtpOneTapButton";
      const otpType = oneTap ? "ONE_TAP" : "ZERO_TAP";
      const packageName = b.props.packageName as string | undefined;
      const signatureHash = b.props.signatureHash as string | undefined;
      if (!packageName || !signatureHash) {
        throw new FlowCompileError(
          `A ${oneTap ? "one-tap" : "zero-tap"} OTP button in "${name}" needs packageName and ` +
            "signatureHash.",
        );
      }
      const comp: TemplateComponent = {
        type: "OTP",
        otp_type: otpType,
        package_name: packageName,
        signature_hash: signatureHash,
      };
      const text = b.props.text as string | undefined;
      const autofill = b.props.autofillText as string | undefined;
      if (text) comp.text = text;
      if (autofill) comp.autofill_text = autofill;
      if (!oneTap) {
        comp.zero_tap_terms_accepted =
          (b.props.zeroTapTermsAccepted as boolean | undefined) ?? true;
      }
      return comp;
    }
    case "MultiProductButton":
      return notImplemented("Template.MultiProduct", "MPM");
    case "VoiceCallButton":
      return notImplemented("Template.VoiceCall", "VOICE_CALL");
    case "AppButton":
      return notImplemented("Template.App", "APP");
    default:
      throw new FlowCompileError(
        `Unsupported button <${b.component}> in "${name}". See Template.* for the available buttons.`,
      );
  }
}

// --- text + variables ------------------------------------------------------

interface VarUse {
  name: string;
  example: string;
}
interface RenderedText {
  /** Text with variables replaced by positional `{{1}}`, `{{2}}` placeholders. */
  text: string;
  /** Text with each variable replaced by its example value. */
  filled: string;
  /** Distinct variables in first-appearance order (the example row). */
  examples: VarUse[];
}

/** Walk a node's flattened children (`#text` and `#var`), assembling the Meta
 * `text` with positional placeholders. Variables are numbered per call (i.e.
 * per component) and deduped by name, so reusing a variable reuses its index. */
function renderText(children: AuthoringNode[], name: string, where: string): RenderedText {
  return renderParts(children, name, where);
}

function renderParts(parts: (string | AuthoringNode)[], name: string, where: string): RenderedText {
  let text = "";
  let filled = "";
  const examples: VarUse[] = [];
  const indexByName = new Map<string, number>();

  for (const part of parts) {
    if (typeof part === "string") {
      text += part;
      filled += part;
      continue;
    }
    if (!isAuthoringNode(part)) continue;
    if (part.component === "#text") {
      const value = String(part.props.value ?? "");
      text += value;
      filled += value;
      continue;
    }
    if (part.component === "#var") {
      const varName = String(part.props.name);
      const example = part.props.example;
      if (typeof example !== "string" || example.length === 0) {
        throw new FlowCompileError(
          `Variable "${varName}" in the ${where} of "${name}" needs a non-empty example: v("${varName}", "…").`,
        );
      }
      let index = indexByName.get(varName);
      if (index === undefined) {
        index = examples.length + 1;
        indexByName.set(varName, index);
        examples.push({ name: varName, example });
      }
      text += `{{${index}}}`;
      filled += example;
      continue;
    }
    throw new FlowCompileError(
      `Unsupported <${part.component}> inside the ${where} text of "${name}". Use plain text and v().`,
    );
  }

  return { text: text.trim(), filled: filled.trim(), examples };
}

/** Render a URL button target. Accepts a plain string (no variable) or a `tpl`
 * template with a single variable that must sit at the very end of the URL. */
function renderUrl(url: unknown, name: string): { text: string; example?: string } {
  if (typeof url === "string") return { text: url };
  if (isAuthoringNode(url) && url.component === "#tpl") {
    const parts = (url.props.parts as (string | AuthoringNode)[]) ?? [];
    const rendered = renderParts(parts, name, "url button");
    if (rendered.examples.length === 0) return { text: rendered.text };
    if (rendered.examples.length > 1) {
      throw new FlowCompileError(
        `URL button in "${name}" allows at most one variable (found ${rendered.examples.length}).`,
      );
    }
    const last = parts[parts.length - 1];
    if (!(isAuthoringNode(last) && last.component === "#var")) {
      throw new FlowCompileError(
        `The variable in the URL button of "${name}" must be at the end of the URL.`,
      );
    }
    return { text: rendered.text, example: rendered.filled };
  }
  throw new FlowCompileError(`URL button in "${name}" must be a string or a tpl\`…\` template.`);
}

// --- helpers ---------------------------------------------------------------

/** "setup-account.tsx" -> "setup_account". */
function fileToTemplateName(file: string): string {
  return path
    .basename(file)
    .replace(/\.(tsx|jsx)$/, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// --- preview ---------------------------------------------------------------

/** A compact, text-only outline of a compiled template for `inspect`. */
export function renderTemplatePreview(t: CompiledTemplate): string[] {
  const out: string[] = [`\n${t.name}  (${t.language}, ${t.category})`];
  for (const c of t.components) {
    const type = String(c.type);
    if (type === "BUTTONS") {
      const buttons = (c.buttons as TemplateComponent[]).map(describeButton).join("  ·  ");
      out.push(`  BUTTONS   ${buttons}`);
    } else if (type === "HEADER" && c.format !== "TEXT") {
      out.push(`  HEADER    ${String(c.format)} (media)`);
    } else {
      out.push(`  ${type.padEnd(8)}  ${JSON.stringify(c.text)}`);
    }
    const example = c.example as { body_text?: string[][]; header_text?: string[] } | undefined;
    const row = example?.body_text?.[0] ?? example?.header_text;
    if (row && row.length)
      out.push(`            e.g. ${row.map((x) => JSON.stringify(x)).join(", ")}`);
  }
  return out;
}

function describeButton(b: TemplateComponent): string {
  switch (b.type) {
    case "URL":
      return `URL "${String(b.text)}" → ${String(b.url)}`;
    case "QUICK_REPLY":
      return `REPLY "${String(b.text)}"`;
    case "PHONE_NUMBER":
      return `PHONE "${String(b.text)}" → ${String(b.phone_number)}`;
    case "FLOW":
      return `FLOW "${String(b.text)}" → ${b.flow_id ? `flow ${String(b.flow_id)}` : "(flow id resolved at push)"}`;
    case "COPY_CODE":
      return `COPY_CODE (e.g. "${String(b.example)}")`;
    case "CATALOG":
      return 'CATALOG "View catalog"';
    case "MARKETING_OPT_OUT":
      return `OPT_OUT "${String(b.text)}"`;
    case "OTP":
      return `OTP ${String(b.otp_type)}${b.text ? ` "${String(b.text)}"` : ""}`;
    default:
      return String(b.type);
  }
}

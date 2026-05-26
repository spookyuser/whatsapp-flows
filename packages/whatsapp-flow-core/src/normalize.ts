import { FlowCompileError } from "./errors.ts";
import { isAuthoringNode, textOf } from "./node.ts";
import { isEnumKind, LEAF_SPEC_BY_TYPE, type LeafSpec, type PropKind } from "./specs.ts";
import {
  type AuthoringNode,
  type DataSourceItem,
  type FlowAction,
  type FlowComponent,
  type FlowLayout,
  type FlowScreen,
  TEXT_NODE,
} from "./types.ts";

export interface NormalizeScreenOptions {
  route: string;
  id: string;
  resolveRoute: (route: string) => string | null;
}

export interface NormalizedScreen {
  screen: FlowScreen;
  edges: string[];
  terminal: boolean;
  completes: boolean;
  usesDataExchange: boolean;
}

interface Build {
  route: string;
  edges: Set<string>;
  completes: boolean;
  usesDataExchange: boolean;
  resolveRoute: (route: string) => string | null;
}

const ACTION_COMPONENTS = ["Next", "Complete", "Exchange", "OpenURL", "UpdateData"];

export function normalizeScreen(root: unknown, opts: NormalizeScreenOptions): NormalizedScreen {
  if (!isAuthoringNode(root) || root.component !== "Screen") {
    throw new FlowCompileError(
      `Screen file for "${opts.route}" must export a default function that returns a <Screen>.`,
      { route: opts.route },
    );
  }
  const build: Build = {
    route: opts.route,
    edges: new Set<string>(),
    completes: false,
    usesDataExchange: false,
    resolveRoute: opts.resolveRoute,
  };

  const layout = buildLayout(root, build);

  const explicitTerminal = root.props.terminal;
  const terminal = typeof explicitTerminal === "boolean" ? explicitTerminal : build.completes;

  const screen = { id: opts.id } as FlowScreen;
  const title = root.props.title;
  if (typeof title === "string") screen.title = title;
  if (terminal) screen.terminal = true;
  if (typeof root.props.success === "boolean") screen.success = root.props.success;
  if (isPlainObject(root.props.data)) screen.data = root.props.data;
  if (Array.isArray(root.props.sensitive)) screen.sensitive = root.props.sensitive as string[];
  screen.layout = layout;

  return {
    screen,
    edges: [...build.edges],
    terminal,
    completes: build.completes,
    usesDataExchange: build.usesDataExchange,
  };
}

function buildLayout(screen: AuthoringNode, build: Build): FlowLayout {
  const layoutChildren = screen.children.filter((c) => c.component !== TEXT_NODE);
  return {
    type: "SingleColumnLayout",
    children: layoutChildren.map((c) => normalizeComponent(c, build, false)),
  };
}

function normalizeComponent(n: AuthoringNode, build: Build, insideForm: boolean): FlowComponent {
  const c = n.component;

  const leaf = LEAF_SPEC_BY_TYPE.get(c);
  if (leaf) {
    if (leaf.category === "input" && !insideForm) {
      throw new FlowCompileError(
        `<${c}> must be placed inside a <Form> on screen "${build.route}".`,
        { route: build.route, component: c },
      );
    }
    return normalizeLeaf(n, leaf, build);
  }

  if (ACTION_COMPONENTS.includes(c)) {
    throw new FlowCompileError(
      `<${c}> must be placed inside a <Footer> (or used as an action prop), not directly in a screen.`,
      { route: build.route, component: c },
    );
  }

  switch (c) {
    case "Form":
      return normalizeForm(n, build);
    case "Footer":
      return normalizeFooter(n, build);
    case "If":
      return normalizeIf(n, build, insideForm);
    case "Switch":
      return normalizeSwitch(n, build, insideForm);
    case "NavigationList":
      return normalizeNavigationList(n, build);
    default:
      throw new FlowCompileError(
        `<${c}> is not a supported Flow component on screen "${build.route}".`,
        { route: build.route, component: c },
      );
  }
}

// --- Leaf components (registry-driven) -------------------------------------

function normalizeLeaf(n: AuthoringNode, spec: LeafSpec, build: Build): FlowComponent {
  const out: Record<string, unknown> = { type: spec.type };
  for (const ps of spec.props) {
    let value: unknown;
    if (ps.childComponent) {
      const items = collectChildItems(n, ps.childComponent);
      value = items.length > 0 ? items : undefined;
    } else {
      value = n.props[ps.prop];
      if (value === undefined && ps.prop === spec.textFallbackProp) {
        const fromChildren = textOf(n);
        if (fromChildren.length > 0) value = fromChildren;
      }
    }
    if (value === undefined) {
      if (ps.required) {
        const need = ps.childComponent
          ? `needs at least one <${ps.childComponent}> child`
          : `is missing required "${ps.prop}"`;
        throw new FlowCompileError(
          `<${spec.type}>${nameHint(n)} on screen "${build.route}" ${need}.`,
          { route: build.route, component: spec.type },
        );
      }
      continue;
    }
    out[ps.key] = coerce(ps.kind, value, spec.type, ps.prop, build);
  }
  return out as unknown as FlowComponent;
}

/** Gather a component's child elements of a given type into plain item objects.
 * Feeds the `dataSource` / `imageList` coercions, so `<Option>`/`<CarouselImage>`
 * children compose into the `data-source` / `images` arrays. */
function collectChildItems(n: AuthoringNode, childComponent: string): Record<string, unknown>[] {
  return n.children.filter((c) => c.component === childComponent).map((c) => ({ ...c.props }));
}

function coerce(
  kind: PropKind,
  value: unknown,
  component: string,
  prop: string,
  build: Build,
): unknown {
  if (isEnumKind(kind)) {
    if (typeof value === "string" && (isRefString(value) || kind.enum.includes(value))) {
      return value;
    }
    throw new FlowCompileError(
      `<${component}> "${prop}" must be one of: ${kind.enum.join(", ")} (got ${JSON.stringify(value)}) on screen "${build.route}".`,
      { route: build.route, component },
    );
  }
  switch (kind) {
    case "action":
      return coerceAction(value, build, component, prop);
    case "dataSource":
      return coerceDataSource(value, component, prop, build);
    case "imageList":
      return coerceImageList(value, component, prop, build);
    default:
      return value;
  }
}

function coerceDataSource(
  value: unknown,
  component: string,
  prop: string,
  build: Build,
): DataSourceItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FlowCompileError(
      `<${component}> "${prop}" must be a non-empty array on screen "${build.route}".`,
      { route: build.route, component },
    );
  }
  return value.map((item, i) => {
    if (typeof item === "string") return { id: String(i), title: item };
    if (isPlainObject(item) && typeof item.title === "string") {
      const out: DataSourceItem = {
        id: typeof item.id === "string" ? item.id : String(i),
        title: item.title,
      };
      if (typeof item.description === "string") out.description = item.description;
      if (typeof item.metadata === "string") out.metadata = item.metadata;
      if (typeof item.enabled === "boolean") out.enabled = item.enabled;
      if (typeof item.image === "string") out.image = item.image;
      if (typeof item["alt-text"] === "string") out["alt-text"] = item["alt-text"];
      if (typeof item.altText === "string") out["alt-text"] = item.altText;
      return out;
    }
    throw new FlowCompileError(
      `<${component}> "${prop}" has an invalid item at index ${i}; each item needs a "title".`,
      { route: build.route, component },
    );
  });
}

function coerceImageList(value: unknown, component: string, prop: string, build: Build): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FlowCompileError(
      `<${component}> "${prop}" must be a non-empty array of images on screen "${build.route}".`,
      { route: build.route, component },
    );
  }
  return value.map((item, i) => {
    if (!isPlainObject(item) || typeof item.src !== "string") {
      throw new FlowCompileError(
        `<${component}> "${prop}" item ${i} needs a "src" (base64 string).`,
        { route: build.route, component },
      );
    }
    const out: Record<string, unknown> = { src: item.src };
    const alt = item.altText ?? item["alt-text"];
    if (typeof alt === "string") out["alt-text"] = alt;
    return out;
  });
}

// --- Actions ---------------------------------------------------------------

function coerceAction(value: unknown, build: Build, component: string, prop: string): FlowAction {
  if (isAuthoringNode(value)) return normalizeAction(value, build).action;
  if (isPlainObject(value) && typeof value.name === "string") {
    return value as unknown as FlowAction;
  }
  throw new FlowCompileError(
    `<${component}> "${prop}" must be an action (<Next>, <Complete>, <Exchange>, <OpenURL>, <UpdateData>) on screen "${build.route}".`,
    { route: build.route, component },
  );
}

function normalizeAction(n: AuthoringNode, build: Build): { action: FlowAction; label: string } {
  switch (n.component) {
    case "Next": {
      const to = requireStr(n, "to", build);
      const id = resolveOrThrow(to, n.component, build);
      build.edges.add(id);
      const action: FlowAction = { name: "navigate", next: { type: "screen", name: id } };
      const payload = objectProp(n, "data");
      if (payload) action.payload = payload;
      return { action, label: actionLabel(n, "Continue") };
    }
    case "Complete": {
      build.completes = true;
      const action: FlowAction = { name: "complete" };
      const payload = objectProp(n, "data");
      if (payload) action.payload = payload;
      return { action, label: actionLabel(n, "Submit") };
    }
    case "Exchange": {
      build.usesDataExchange = true;
      const next = strProp(n, "next");
      if (next) build.edges.add(resolveOrThrow(next, n.component, build));
      const action: FlowAction = { name: "data_exchange" };
      const actionName = strProp(n, "action");
      const data = objectProp(n, "data");
      const payload = actionName ? { action: actionName, ...(data ?? {}) } : data;
      if (payload) action.payload = payload;
      return { action, label: actionLabel(n, "Continue") };
    }
    case "OpenURL": {
      const url = requireStr(n, "url", build);
      return { action: { name: "open_url", url }, label: actionLabel(n, "Open") };
    }
    case "UpdateData": {
      const payload = objectProp(n, "data") ?? {};
      return { action: { name: "update_data", payload }, label: actionLabel(n, "Update") };
    }
    default:
      throw new FlowCompileError(
        `<${n.component}> is not a valid action. Use <Next>, <Complete>, <Exchange>, <OpenURL>, or <UpdateData>.`,
        { route: build.route, component: n.component },
      );
  }
}

function actionLabel(n: AuthoringNode, fallback: string): string {
  return textOf(n) || strProp(n, "label") || fallback;
}

function resolveOrThrow(route: string, component: string, build: Build): string {
  const id = build.resolveRoute(route);
  if (id === null) {
    const verb = component === "Exchange" ? "next" : "to";
    throw new FlowCompileError(
      `Screen "${build.route}" has a <${component} ${verb}="${route}">, but no screen exports that route.`,
      { route: build.route, component },
    );
  }
  return id;
}

// --- Structural components -------------------------------------------------

function normalizeForm(n: AuthoringNode, build: Build): FlowComponent {
  const name = strProp(n, "name") ?? "form";
  const children = n.children
    .filter((c) => c.component !== TEXT_NODE)
    .map((c) => normalizeComponent(c, build, true));

  const seen = new Set<string>();
  for (const fieldName of collectFieldNames(children)) {
    if (seen.has(fieldName)) {
      throw new FlowCompileError(
        `Form "${name}" on screen "${build.route}" has more than one field named "${fieldName}". Field names must be unique within a form.`,
        { route: build.route, component: "Form" },
      );
    }
    seen.add(fieldName);
  }

  return { type: "Form", name, children } as unknown as FlowComponent;
}

function normalizeFooter(n: AuthoringNode, build: Build): FlowComponent {
  const actionChildren = n.children.filter((c) => c.component !== TEXT_NODE);
  if (actionChildren.length !== 1) {
    throw new FlowCompileError(
      `<Footer> on screen "${build.route}" must contain exactly one action: <Next>, <Complete>, or <Exchange>.`,
      { route: build.route, component: "Footer" },
    );
  }
  const { action, label } = normalizeAction(actionChildren[0]!, build);
  const footer: Record<string, unknown> = {
    type: "Footer",
    label: strProp(n, "label") ?? label,
    "on-click-action": action,
  };
  put(footer, "left-caption", n.props.leftCaption);
  put(footer, "center-caption", n.props.centerCaption);
  put(footer, "right-caption", n.props.rightCaption);
  put(footer, "enabled", n.props.enabled);
  return footer as unknown as FlowComponent;
}

function normalizeIf(n: AuthoringNode, build: Build, insideForm: boolean): FlowComponent {
  const condition = requireStr(n, "condition", build);
  const elseNode = n.children.find((c) => c.component === "Else");
  const thenNodes = n.children.filter((c) => c.component !== TEXT_NODE && c.component !== "Else");
  const out: Record<string, unknown> = {
    type: "If",
    condition,
    then: thenNodes.map((c) => normalizeComponent(c, build, insideForm)),
  };
  if (elseNode) {
    const elseNodes = elseNode.children.filter((c) => c.component !== TEXT_NODE);
    if (elseNodes.length > 0) {
      out.else = elseNodes.map((c) => normalizeComponent(c, build, insideForm));
    }
  }
  return out as unknown as FlowComponent;
}

function normalizeSwitch(n: AuthoringNode, build: Build, insideForm: boolean): FlowComponent {
  const value = requireStr(n, "value", build);
  const cases: Record<string, FlowComponent[]> = {};
  for (const child of n.children) {
    if (child.component === TEXT_NODE) continue;
    const key =
      child.component === "Case"
        ? requireStr(child, "value", build)
        : child.component === "Default"
          ? "default"
          : null;
    if (key === null) {
      throw new FlowCompileError(
        `<Switch> on screen "${build.route}" only accepts <Case> and <Default> children (got <${child.component}>).`,
        { route: build.route, component: "Switch" },
      );
    }
    cases[key] = child.children
      .filter((c) => c.component !== TEXT_NODE)
      .map((c) => normalizeComponent(c, build, insideForm));
  }
  if (Object.keys(cases).length === 0) {
    throw new FlowCompileError(`<Switch> on screen "${build.route}" needs at least one <Case>.`, {
      route: build.route,
      component: "Switch",
    });
  }
  return { type: "Switch", value, cases } as unknown as FlowComponent;
}

function normalizeNavigationList(n: AuthoringNode, build: Build): FlowComponent {
  const name = requireStr(n, "name", build);
  const itemNodes = n.children.filter((c) => c.component === "NavItem");
  if (itemNodes.length === 0) {
    throw new FlowCompileError(
      `<NavigationList> "${name}" on screen "${build.route}" needs at least one <NavItem> child.`,
      { route: build.route, component: "NavigationList" },
    );
  }
  const out: Record<string, unknown> = {
    type: "NavigationList",
    name,
    "list-items": itemNodes.map((c, i) => normalizeNavItem({ ...c.props }, i, build)),
  };
  put(out, "label", n.props.label);
  put(out, "description", n.props.description);
  put(out, "media-size", n.props.mediaSize);
  if (n.props.onClickAction !== undefined) {
    out["on-click-action"] = coerceAction(
      n.props.onClickAction,
      build,
      "NavigationList",
      "onClickAction",
    );
  }
  put(out, "visible", n.props.visible);
  return out as unknown as FlowComponent;
}

function normalizeNavItem(item: unknown, i: number, build: Build): Record<string, unknown> {
  if (!isPlainObject(item) || typeof item.title !== "string") {
    throw new FlowCompileError(
      `<NavigationList> item ${i} on screen "${build.route}" needs a "title".`,
      { route: build.route, component: "NavigationList" },
    );
  }
  const mainContent: Record<string, unknown> = { title: item.title };
  if (typeof item.description === "string") mainContent.description = item.description;
  if (typeof item.metadata === "string") mainContent.metadata = item.metadata;

  const out: Record<string, unknown> = {
    id: typeof item.id === "string" ? item.id : String(i),
    "main-content": mainContent,
  };
  if (typeof item.image === "string") out.start = { image: item.image };
  if (Array.isArray(item.tags)) out.tags = item.tags;
  if (typeof item.badge === "string") out.badge = item.badge;
  if (item.onClickAction !== undefined) {
    out["on-click-action"] = coerceAction(
      item.onClickAction,
      build,
      "NavigationList",
      "onClickAction",
    );
  }
  return out;
}

// --- Field-name collection (recurses through If/Switch) --------------------

function collectFieldNames(components: FlowComponent[]): string[] {
  const out: string[] = [];
  const walk = (list: FlowComponent[]): void => {
    for (const c of list) {
      const rec = c as unknown as Record<string, unknown>;
      if (typeof rec.name === "string" && rec.type !== "Form") out.push(rec.name);
      if (rec.type === "If") {
        walk((rec.then as FlowComponent[]) ?? []);
        walk((rec.else as FlowComponent[]) ?? []);
      } else if (rec.type === "Switch") {
        for (const arr of Object.values((rec.cases as Record<string, FlowComponent[]>) ?? {})) {
          walk(arr);
        }
      }
    }
  };
  walk(components);
  return out;
}

// --- helpers ---------------------------------------------------------------

function requireStr(n: AuthoringNode, key: string, build: Build): string {
  const v = strProp(n, key);
  if (!v) {
    throw new FlowCompileError(`<${n.component}> on screen "${build.route}" is missing "${key}".`, {
      route: build.route,
      component: n.component,
    });
  }
  return v;
}

function nameHint(n: AuthoringNode): string {
  const name = strProp(n, "name");
  return name ? ` "${name}"` : "";
}

function strProp(n: AuthoringNode, key: string): string | undefined {
  const v = n.props[key];
  return typeof v === "string" ? v : undefined;
}

function objectProp(n: AuthoringNode, key: string): Record<string, unknown> | undefined {
  const v = n.props[key];
  return isPlainObject(v) && Object.keys(v).length > 0 ? v : undefined;
}

function put(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (value !== undefined) obj[key] = value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRefString(v: string): boolean {
  return /^\$\{[^}]+\}$/.test(v);
}

import type { FlowAction, FlowComponent } from "whatsapp-flow-core";
import type { CompileResult } from "./build.ts";

/** Lightweight, text-based preview of a compiled flow: route map, transitions,
 * and a per-screen component outline. (Not a faithful WhatsApp UI.) */
export function renderInspect(result: CompileResult): string {
  const { flow, routes, warnings, config, startId } = result;
  const out: string[] = [];

  out.push(`Flow: ${config.name}`);
  out.push(
    `Version: ${flow.version}${flow.data_api_version ? `  data_api_version: ${flow.data_api_version}` : ""}`,
  );
  out.push(`Start: ${config.start} (${startId})`);
  out.push("");

  const routeW = Math.max(5, ...routes.map((r) => r.route.length));
  const idW = Math.max(2, ...routes.map((r) => r.id.length));
  out.push("Routes:");
  for (const r of routes) {
    const terminal = flow.screens.find((s) => s.id === r.id)?.terminal;
    out.push(
      `  ${r.route.padEnd(routeW)}  ${r.id.padEnd(idW)}  ${r.rel}${terminal ? "  [terminal]" : ""}`,
    );
  }
  out.push("");

  out.push("Transitions:");
  for (const [from, targets] of Object.entries(flow.routing_model)) {
    out.push(`  ${from.padEnd(idW)} -> ${targets.length ? targets.join(", ") : "(end)"}`);
  }
  out.push("");

  out.push("Screens:");
  for (const screen of flow.screens) {
    out.push(`  ${screen.id}${screen.title ? `  "${screen.title}"` : ""}`);
    for (const child of screen.layout.children) {
      out.push(...describeComponent(child, 2));
    }
  }

  if (warnings.length) {
    out.push("");
    out.push("Warnings:");
    for (const w of warnings) out.push(`  - ${w}`);
  }

  return out.join("\n");
}

function describeComponent(c: FlowComponent, depth: number): string[] {
  const pad = "  ".repeat(depth);
  const rec = c as Record<string, unknown>;
  const kids = (v: unknown): FlowComponent[] => (Array.isArray(v) ? (v as FlowComponent[]) : []);
  switch (c.type) {
    case "Form": {
      const lines = [`${pad}Form "${String(rec.name)}"`];
      for (const child of kids(rec.children)) lines.push(...describeComponent(child, depth + 1));
      return lines;
    }
    case "Footer":
      return [
        `${pad}Footer [${describeAction(rec["on-click-action"] as FlowAction)}] "${String(rec.label)}"`,
      ];
    case "If": {
      const lines = [`${pad}If ${String(rec.condition)}`];
      for (const child of kids(rec.then)) lines.push(...describeComponent(child, depth + 1));
      if (Array.isArray(rec.else)) {
        lines.push(`${pad}else`);
        for (const child of kids(rec.else)) lines.push(...describeComponent(child, depth + 1));
      }
      return lines;
    }
    case "Switch": {
      const lines = [`${pad}Switch ${String(rec.value)}`];
      for (const [key, arr] of Object.entries((rec.cases as Record<string, unknown>) ?? {})) {
        lines.push(`${pad}  case ${key}`);
        for (const child of kids(arr)) lines.push(...describeComponent(child, depth + 2));
      }
      return lines;
    }
    case "NavigationList":
      return [`${pad}NavigationList ${String(rec.name)} (${kids(rec["list-items"]).length} items)`];
    case "TextHeading":
    case "TextSubheading":
    case "TextBody":
    case "TextCaption":
    case "RichText":
      return [`${pad}${c.type} ${JSON.stringify(rec.text)}`];
    case "Dropdown":
    case "CheckboxGroup":
    case "RadioButtonsGroup":
    case "ChipsSelector":
      return [`${pad}${c.type} ${String(rec.name)} (${kids(rec["data-source"]).length} options)`];
    default: {
      const name = typeof rec.name === "string" ? ` ${rec.name}` : "";
      return [`${pad}${c.type}${name}${rec.required === true ? " *" : ""}`];
    }
  }
}

function describeAction(a: FlowAction): string {
  switch (a.name) {
    case "navigate":
      return `navigate → ${a.next.name}`;
    case "complete":
      return "complete";
    case "data_exchange":
      return "data_exchange";
    case "open_url":
      return `open_url ${a.url}`;
    case "update_data":
      return "update_data";
    default:
      return (a as { name: string }).name;
  }
}

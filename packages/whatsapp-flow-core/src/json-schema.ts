import {
  isEnumKind,
  LEAF_SPECS,
  type LeafSpec,
  type PropKind,
} from "./specs.ts";

type JsonSchema = Record<string, unknown>;

const REF_PATTERN = "^\\$\\{.+\\}$";
const boolOrDynamic: JsonSchema = { type: ["boolean", "string"] };

function kindToSchema(kind: PropKind): JsonSchema {
  if (isEnumKind(kind)) {
    return { anyOf: [{ type: "string", enum: kind.enum }, { type: "string", pattern: REF_PATTERN }] };
  }
  switch (kind) {
    case "str":
      return { type: "string" };
    case "bool":
      return boolOrDynamic;
    case "num":
      return { type: "number" };
    case "text":
      return { anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] };
    case "labelOrObject":
      return { anyOf: [{ type: "string" }, { type: "object" }] };
    case "stringArray":
      return { type: "array", items: { type: "string" } };
    case "dataSource":
      return { type: "array", minItems: 1, items: { $ref: "#/definitions/dataSourceItem" } };
    case "imageList":
      return { type: "array", minItems: 1, items: { $ref: "#/definitions/imageItem" } };
    case "action":
      return { $ref: "#/definitions/action" };
  }
}

function leafSchema(spec: LeafSpec): JsonSchema {
  const properties: Record<string, JsonSchema> = { type: { const: spec.type } };
  const required = ["type"];
  for (const ps of spec.props) {
    properties[ps.key] = kindToSchema(ps.kind);
    if (ps.required) required.push(ps.key);
  }
  return { type: "object", additionalProperties: false, required, properties };
}

const componentRef = { $ref: "#/definitions/component" };
const componentArray: JsonSchema = { type: "array", items: componentRef };
const payload: JsonSchema = { type: "object" };

const actionSchemas: JsonSchema[] = [
  {
    type: "object",
    additionalProperties: false,
    required: ["name", "next"],
    properties: {
      name: { const: "navigate" },
      next: {
        type: "object",
        additionalProperties: false,
        required: ["type", "name"],
        properties: { type: { const: "screen" }, name: { type: "string" } },
      },
      payload,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: { name: { const: "complete" }, payload },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["name"],
    properties: { name: { const: "data_exchange" }, payload },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["name", "url"],
    properties: { name: { const: "open_url" }, url: { type: "string" } },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["name", "payload"],
    properties: { name: { const: "update_data" }, payload },
  },
];

const structuralSchemas: JsonSchema[] = [
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "name", "children"],
    properties: {
      type: { const: "Form" },
      name: { type: "string" },
      children: componentArray,
      "init-values": { type: "object" },
      "error-messages": { type: "object" },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "label", "on-click-action"],
    properties: {
      type: { const: "Footer" },
      label: { type: "string" },
      "on-click-action": { $ref: "#/definitions/action" },
      "left-caption": { type: "string" },
      "center-caption": { type: "string" },
      "right-caption": { type: "string" },
      enabled: boolOrDynamic,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "condition", "then"],
    properties: {
      type: { const: "If" },
      condition: { type: "string" },
      then: componentArray,
      else: componentArray,
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "value", "cases"],
    properties: {
      type: { const: "Switch" },
      value: { type: "string" },
      cases: { type: "object", additionalProperties: componentArray },
    },
  },
  {
    type: "object",
    additionalProperties: false,
    required: ["type", "name", "list-items"],
    properties: {
      type: { const: "NavigationList" },
      name: { type: "string" },
      label: { type: "string" },
      description: { type: "string" },
      "media-size": { type: "string" },
      "list-items": { type: "array", minItems: 1, items: { $ref: "#/definitions/navItem" } },
      "on-click-action": { $ref: "#/definitions/action" },
      visible: boolOrDynamic,
    },
  },
];

/** Build the JSON Schema (draft-07) that formally describes a valid Flow JSON
 * document, including every supported component and action. */
export function buildFlowJsonSchema(): JsonSchema {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "https://whatsapp-flows/flow.schema.json",
    title: "WhatsApp Flow JSON",
    type: "object",
    additionalProperties: false,
    required: ["version", "screens"],
    properties: {
      version: { type: "string" },
      data_api_version: { type: "string" },
      data_channel_uri: { type: "string" },
      routing_model: {
        type: "object",
        additionalProperties: { type: "array", items: { type: "string" } },
      },
      screens: { type: "array", items: { $ref: "#/definitions/screen" } },
    },
    definitions: {
      screen: {
        type: "object",
        additionalProperties: false,
        required: ["id", "layout"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          terminal: { type: "boolean" },
          success: { type: "boolean" },
          data: { type: "object" },
          sensitive: { type: "array", items: { type: "string" } },
          layout: { $ref: "#/definitions/layout" },
        },
      },
      layout: {
        type: "object",
        additionalProperties: false,
        required: ["type", "children"],
        properties: {
          type: { const: "SingleColumnLayout" },
          children: componentArray,
        },
      },
      component: { oneOf: [...LEAF_SPECS.map(leafSchema), ...structuralSchemas] },
      action: { oneOf: actionSchemas },
      dataSourceItem: {
        type: "object",
        additionalProperties: false,
        required: ["id", "title"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          metadata: { type: "string" },
          enabled: { type: "boolean" },
          image: { type: "string" },
          "alt-text": { type: "string" },
        },
      },
      imageItem: {
        type: "object",
        additionalProperties: false,
        required: ["src"],
        properties: { src: { type: "string" }, "alt-text": { type: "string" } },
      },
      navItem: {
        type: "object",
        additionalProperties: false,
        required: ["id", "main-content"],
        properties: {
          id: { type: "string" },
          "main-content": {
            type: "object",
            additionalProperties: false,
            required: ["title"],
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              metadata: { type: "string" },
            },
          },
          start: {
            type: "object",
            additionalProperties: false,
            required: ["image"],
            properties: { image: { type: "string" } },
          },
          end: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              metadata: { type: "string" },
            },
          },
          badge: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          "on-click-action": { $ref: "#/definitions/action" },
        },
      },
    },
  };
}

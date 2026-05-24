// Single source of truth for "leaf" Flow components (everything except the
// structural Form / Footer / Screen / If / Switch / NavigationList).
// Both the normalizer (normalize.ts) and the JSON Schema generator
// (json-schema.ts) are driven by this registry so they cannot drift.

export interface EnumKind {
  enum: string[];
}
export type PropKind =
  | "str" //   plain string (literal or ${ref})
  | "bool" //  boolean | dynamic ${ref} string
  | "num" //   number
  | "text" //  string | string[]
  | "labelOrObject" // string | { [k]: string }  (CalendarPicker label)
  | "stringArray" // string[]
  | "dataSource" //   DataSourceItem[]
  | "imageList" //    { src, alt-text? }[]
  | "action" //       FlowAction
  | EnumKind;

export interface PropSpec {
  /** Authoring (camelCase) prop name. */
  prop: string;
  /** Flow JSON (kebab-case) key. */
  key: string;
  kind: PropKind;
  required?: boolean;
  /** When set, the value is composed from child elements of this component
   * (e.g. `<Option>` inside `<Dropdown>`) rather than from a prop. */
  childComponent?: string;
}

export interface LeafSpec {
  type: string;
  category: "display" | "input";
  /** Prop whose value falls back to the element's text children when omitted. */
  textFallbackProp?: string;
  props: PropSpec[];
}

export function isEnumKind(kind: PropKind): kind is EnumKind {
  return typeof kind === "object";
}

const visible: PropSpec = { prop: "visible", key: "visible", kind: "bool" };
const enabled: PropSpec = { prop: "enabled", key: "enabled", kind: "bool" };
const errorMessage: PropSpec = {
  prop: "errorMessage",
  key: "error-message",
  kind: "str",
};
const dataSource: PropSpec = {
  prop: "dataSource",
  key: "data-source",
  kind: "dataSource",
  required: true,
  childComponent: "Option",
};

const INPUT_TYPES = ["text", "number", "email", "password", "passcode", "phone"];

export const LEAF_SPECS: LeafSpec[] = [
  // --- Text / display ------------------------------------------------------
  {
    type: "TextHeading",
    category: "display",
    textFallbackProp: "text",
    props: [{ prop: "text", key: "text", kind: "str", required: true }, visible],
  },
  {
    type: "TextSubheading",
    category: "display",
    textFallbackProp: "text",
    props: [{ prop: "text", key: "text", kind: "str", required: true }, visible],
  },
  {
    type: "TextBody",
    category: "display",
    textFallbackProp: "text",
    props: [
      { prop: "text", key: "text", kind: "text", required: true },
      { prop: "markdown", key: "markdown", kind: "bool" },
      { prop: "fontWeight", key: "font-weight", kind: "str" },
      { prop: "strikethrough", key: "strikethrough", kind: "bool" },
      visible,
    ],
  },
  {
    type: "TextCaption",
    category: "display",
    textFallbackProp: "text",
    props: [
      { prop: "text", key: "text", kind: "text", required: true },
      { prop: "markdown", key: "markdown", kind: "bool" },
      { prop: "fontWeight", key: "font-weight", kind: "str" },
      { prop: "strikethrough", key: "strikethrough", kind: "bool" },
      visible,
    ],
  },
  {
    type: "RichText",
    category: "display",
    textFallbackProp: "text",
    props: [{ prop: "text", key: "text", kind: "text", required: true }, visible],
  },
  {
    type: "Image",
    category: "display",
    props: [
      { prop: "src", key: "src", kind: "str", required: true },
      { prop: "width", key: "width", kind: "num" },
      { prop: "height", key: "height", kind: "num" },
      { prop: "scaleType", key: "scale-type", kind: "str" },
      { prop: "aspectRatio", key: "aspect-ratio", kind: "num" },
      { prop: "altText", key: "alt-text", kind: "str" },
      visible,
    ],
  },
  {
    type: "ImageCarousel",
    category: "display",
    props: [
      {
        prop: "images",
        key: "images",
        kind: "imageList",
        required: true,
        childComponent: "CarouselImage",
      },
      { prop: "scaleType", key: "scale-type", kind: "str" },
      { prop: "aspectRatio", key: "aspect-ratio", kind: "num" },
      visible,
    ],
  },
  {
    type: "EmbeddedLink",
    category: "display",
    textFallbackProp: "text",
    props: [
      { prop: "text", key: "text", kind: "str", required: true },
      { prop: "onClickAction", key: "on-click-action", kind: "action", required: true },
      visible,
    ],
  },

  // --- Inputs (must live inside a Form) ------------------------------------
  {
    type: "TextInput",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "inputType", key: "input-type", kind: { enum: INPUT_TYPES } },
      { prop: "pattern", key: "pattern", kind: "str" },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "minChars", key: "min-chars", kind: "num" },
      { prop: "maxChars", key: "max-chars", kind: "num" },
      { prop: "helperText", key: "helper-text", kind: "str" },
      { prop: "initValue", key: "init-value", kind: "str" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "TextArea",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "maxLength", key: "max-length", kind: "num" },
      { prop: "helperText", key: "helper-text", kind: "str" },
      { prop: "initValue", key: "init-value", kind: "str" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "Dropdown",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      dataSource,
      { prop: "required", key: "required", kind: "bool" },
      { prop: "initValue", key: "init-value", kind: "str" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      { prop: "onUnselectAction", key: "on-unselect-action", kind: "action" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "RadioButtonsGroup",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "description", key: "description", kind: "str" },
      dataSource,
      { prop: "required", key: "required", kind: "bool" },
      { prop: "initValue", key: "init-value", kind: "str" },
      { prop: "mediaSize", key: "media-size", kind: "str" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      { prop: "onUnselectAction", key: "on-unselect-action", kind: "action" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "CheckboxGroup",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "description", key: "description", kind: "str" },
      dataSource,
      { prop: "minSelectedItems", key: "min-selected-items", kind: "num" },
      { prop: "maxSelectedItems", key: "max-selected-items", kind: "num" },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "initValue", key: "init-value", kind: "stringArray" },
      { prop: "mediaSize", key: "media-size", kind: "str" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      { prop: "onUnselectAction", key: "on-unselect-action", kind: "action" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "ChipsSelector",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "description", key: "description", kind: "str" },
      dataSource,
      { prop: "minSelectedItems", key: "min-selected-items", kind: "num" },
      { prop: "maxSelectedItems", key: "max-selected-items", kind: "num" },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "initValue", key: "init-value", kind: "stringArray" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      { prop: "onUnselectAction", key: "on-unselect-action", kind: "action" },
      enabled,
      visible,
    ],
  },
  {
    type: "OptIn",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "initValue", key: "init-value", kind: "bool" },
      { prop: "onClickAction", key: "on-click-action", kind: "action" },
      visible,
    ],
  },
  {
    type: "DatePicker",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "minDate", key: "min-date", kind: "str" },
      { prop: "maxDate", key: "max-date", kind: "str" },
      { prop: "unavailableDates", key: "unavailable-dates", kind: "stringArray" },
      { prop: "helperText", key: "helper-text", kind: "str" },
      { prop: "initValue", key: "init-value", kind: "str" },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      enabled,
      visible,
    ],
  },
  {
    type: "CalendarPicker",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "labelOrObject", required: true },
      { prop: "mode", key: "mode", kind: "str" },
      { prop: "minDate", key: "min-date", kind: "str" },
      { prop: "maxDate", key: "max-date", kind: "str" },
      { prop: "unavailableDates", key: "unavailable-dates", kind: "stringArray" },
      { prop: "includeDays", key: "include-days", kind: "stringArray" },
      { prop: "helperText", key: "helper-text", kind: "str" },
      { prop: "required", key: "required", kind: "bool" },
      { prop: "onSelectAction", key: "on-select-action", kind: "action" },
      enabled,
      visible,
    ],
  },
  {
    type: "PhotoPicker",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "description", key: "description", kind: "str" },
      {
        prop: "photoSource",
        key: "photo-source",
        kind: { enum: ["camera_gallery", "camera", "gallery"] },
      },
      { prop: "maxFileSizeKb", key: "max-file-size-kb", kind: "num" },
      { prop: "minUploadedPhotos", key: "min-uploaded-photos", kind: "num" },
      { prop: "maxUploadedPhotos", key: "max-uploaded-photos", kind: "num" },
      enabled,
      visible,
      errorMessage,
    ],
  },
  {
    type: "DocumentPicker",
    category: "input",
    props: [
      { prop: "name", key: "name", kind: "str", required: true },
      { prop: "label", key: "label", kind: "str", required: true },
      { prop: "description", key: "description", kind: "str" },
      { prop: "allowedMimeTypes", key: "allowed-mime-types", kind: "stringArray" },
      { prop: "maxFileSizeKb", key: "max-file-size-kb", kind: "num" },
      { prop: "minUploadedDocuments", key: "min-uploaded-documents", kind: "num" },
      { prop: "maxUploadedDocuments", key: "max-uploaded-documents", kind: "num" },
      enabled,
      visible,
      errorMessage,
    ],
  },
];

export const LEAF_SPEC_BY_TYPE: Map<string, LeafSpec> = new Map(LEAF_SPECS.map((s) => [s.type, s]));

/** Component types that may only appear inside a <Form>. */
export const INPUT_TYPES_SET: Set<string> = new Set(
  LEAF_SPECS.filter((s) => s.category === "input").map((s) => s.type),
);

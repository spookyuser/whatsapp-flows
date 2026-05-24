export * from "./components.ts";
export * from "./actions.ts";
export {
  defineFlow,
  type FlowConfig,
  defineFlowsApp,
  type FlowsAppConfig,
  type WabaConfig,
} from "./define-flow.ts";
export { defineTemplate, type TemplateConfig, type TemplateCategory } from "./define-template.ts";
export {
  Template,
  v,
  tpl,
  type TemplateProps,
  type HeaderProps,
  type HeaderFormat,
  type BodyProps,
  type FooterProps,
  type ButtonsProps,
  type URLButtonProps,
  type QuickReplyProps,
  type PhoneButtonProps,
} from "./template.ts";
export type { ScreenComponent } from "./screen.ts";

// Reference helpers + shared types, re-exported for one-import authoring.
export {
  field,
  data,
  screenData,
  isRef,
  type Ref,
  type AuthoringNode,
  type AuthoringChild,
  type DataSourceItem,
} from "whatsapp-flow-core";

import { type AuthoringChild, type AuthoringNode, node } from "whatsapp-flow-core";

// Message-template authoring components. A template is a single message —
// header, body, footer, and a row of buttons — not a multi-screen flow. The
// structural pieces are namespaced under `Template.*` (e.g. `<Template.Body>`)
// so they never collide with the flow components (`Footer`, `Image`, …).

type Children = AuthoringChild | AuthoringChild[];
interface WithChildren {
  children?: Children;
}

function el(component: string, props: object): AuthoringNode {
  return node(component, props as Record<string, unknown>, (props as WithChildren).children);
}

// --- Variables -------------------------------------------------------------

/** A template variable with the example value Meta requires for review. Drop it
 * straight into text as a child — `<Template.Body>Hi {v("name", "Sam")}</…>` —
 * or into a `tpl` URL. The compiler numbers it `{{1}}`, `{{2}}`… per component
 * (deduping by name) and gathers the examples, so you never hand-sync indices. */
export function v(name: string, example: string): AuthoringNode {
  return node("#var", { name, example });
}

/** Tagged-template builder for variable-bearing strings — used where a variable
 * lives inside a prop rather than as a child, e.g. a URL button target:
 * ``url={tpl`https://acme.com/order/${v("id", "A123")}`}``. */
export function tpl(
  strings: TemplateStringsArray,
  ...values: (string | AuthoringNode)[]
): AuthoringNode {
  const parts: (string | AuthoringNode)[] = [];
  strings.forEach((s, i) => {
    if (s) parts.push(s);
    const value = values[i];
    if (value !== undefined) parts.push(value);
  });
  return node("#tpl", { parts });
}

// --- Structural components -------------------------------------------------

export type TemplateProps = WithChildren;
function TemplateRoot(props: TemplateProps): AuthoringNode {
  return el("Template", props);
}

export type HeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
export interface HeaderProps extends WithChildren {
  /** Header type. Defaults to TEXT (children are the header text). */
  format?: HeaderFormat;
  /** Media headers (IMAGE/VIDEO/DOCUMENT) need an example media handle obtained
   * from Meta's resumable upload API. Text headers ignore this. */
  handle?: string;
}
function Header(props: HeaderProps): AuthoringNode {
  return el("Header", props);
}

export type BodyProps = WithChildren;
function Body(props: BodyProps): AuthoringNode {
  return el("Body", props);
}

export type FooterProps = WithChildren;
function Footer(props: FooterProps): AuthoringNode {
  return el("Footer", props);
}

export type ButtonsProps = WithChildren;
function Buttons(props: ButtonsProps): AuthoringNode {
  return el("Buttons", props);
}

export interface URLButtonProps {
  text: string;
  /** A static URL string, or a `tpl` template with a single trailing variable. */
  url: string | AuthoringNode;
}
function URLButton(props: URLButtonProps): AuthoringNode {
  return node("URLButton", { text: props.text, url: props.url });
}

export interface QuickReplyProps extends WithChildren {
  /** Button label. May also be supplied as text children. */
  text?: string;
}
function QuickReply(props: QuickReplyProps): AuthoringNode {
  return el("QuickReply", props);
}

export interface PhoneButtonProps {
  text: string;
  phoneNumber: string;
}
function PhoneButton(props: PhoneButtonProps): AuthoringNode {
  return node("PhoneButton", { text: props.text, phoneNumber: props.phoneNumber });
}

// --- Additional button types -----------------------------------------------

export interface FlowButtonProps {
  /** Button label. */
  text: string;
  /** Reference a Flow authored in THIS app by name; `flows push` resolves its
   * per-env flow id. Provide exactly one of `flowName` or `flowId`. */
  flowName?: string;
  /** Raw Meta flow id — escape hatch for a flow not authored in this app. */
  flowId?: string;
  /** "navigate" (default) opens a screen in the flow; "data_exchange" posts to
   * your endpoint for the first screen. */
  flowAction?: "navigate" | "data_exchange";
  /** First screen id to open. Required when `flowAction` is "navigate". */
  navigateScreen?: string;
}
function FlowButton(props: FlowButtonProps): AuthoringNode {
  return node("FlowButton", {
    text: props.text,
    flowName: props.flowName,
    flowId: props.flowId,
    flowAction: props.flowAction,
    navigateScreen: props.navigateScreen,
  });
}

export interface CopyCodeButtonProps {
  /** Example coupon code Meta shows reviewers (the live code is sent at
   * send-time as a button parameter). Max 15 characters. */
  code: string;
}
function CopyCodeButton(props: CopyCodeButtonProps): AuthoringNode {
  return node("CopyCodeButton", { code: props.code });
}

export interface CatalogButtonProps {
  /** CATALOG label is fixed by WhatsApp to "View catalog" — no props needed. */
  text?: never;
}
function CatalogButton(_props?: CatalogButtonProps): AuthoringNode {
  return node("CatalogButton", {});
}

export interface OptOutButtonProps {
  /** Button label. Defaults to "Stop promotions". */
  text?: string;
}
function OptOutButton(props: OptOutButtonProps = {}): AuthoringNode {
  return node("OptOutButton", { text: props.text });
}

export interface OtpCopyCodeButtonProps {
  /** Button label. Defaults to WhatsApp's "Copy code". */
  text?: string;
}
function OtpCopyCodeButton(props: OtpCopyCodeButtonProps = {}): AuthoringNode {
  return node("OtpCopyCodeButton", { text: props.text });
}

export interface OtpOneTapButtonProps {
  /** Button label. Defaults to WhatsApp's "Copy code". */
  text?: string;
  /** Autofill button label (Android). */
  autofillText?: string;
  /** Your Android app package name (required for one-tap autofill). */
  packageName: string;
  /** Your app's signing-key signature hash (required for one-tap autofill). */
  signatureHash: string;
}
function OtpOneTapButton(props: OtpOneTapButtonProps): AuthoringNode {
  return node("OtpOneTapButton", {
    text: props.text,
    autofillText: props.autofillText,
    packageName: props.packageName,
    signatureHash: props.signatureHash,
  });
}

export interface OtpZeroTapButtonProps extends OtpOneTapButtonProps {
  /** Confirms you've accepted Meta's zero-tap terms. Defaults to true. */
  zeroTapTermsAccepted?: boolean;
}
function OtpZeroTapButton(props: OtpZeroTapButtonProps): AuthoringNode {
  return node("OtpZeroTapButton", {
    text: props.text,
    autofillText: props.autofillText,
    packageName: props.packageName,
    signatureHash: props.signatureHash,
    zeroTapTermsAccepted: props.zeroTapTermsAccepted,
  });
}

// --- Not implemented yet (exposed for discoverability) ---------------------
// These compile to a clear "not implemented yet" error. They exist so the full
// Meta button surface is visible via autocomplete and TypeScript before the
// implementation lands.

export interface MultiProductButtonProps {
  /** Button label. */
  text?: string;
}
/** Not implemented yet. Multi-product message (MPM) button. Exposed so you can
 * see the full button surface; compiling it fails with a clear error. */
function MultiProductButton(props: MultiProductButtonProps = {}): AuthoringNode {
  return node("MultiProductButton", { text: props.text });
}

export interface VoiceCallButtonProps {
  /** Button label. */
  text?: string;
}
/** Not implemented yet. Voice-call button. Exposed so you can see the full
 * button surface; compiling it fails with a clear error. */
function VoiceCallButton(props: VoiceCallButtonProps = {}): AuthoringNode {
  return node("VoiceCallButton", { text: props.text });
}

export interface AppButtonProps {
  /** Button label. */
  text?: string;
  /** Deep-link / web URL the app button opens. */
  url?: string;
  /** Android app package name. */
  packageName?: string;
  /** App signing-key signature hash. */
  signatureHash?: string;
}
/** Not implemented yet. App / deep-link button. Exposed so you can see the full
 * button surface; compiling it fails with a clear error. */
function AppButton(props: AppButtonProps = {}): AuthoringNode {
  return node("AppButton", {
    text: props.text,
    url: props.url,
    packageName: props.packageName,
    signatureHash: props.signatureHash,
  });
}

/** Root of a message template. Compose its parts as namespaced children:
 * `<Template.Header>`, `<Template.Body>`, `<Template.Footer>`,
 * `<Template.Buttons>` (with button children inside). Only Body is required. */
export const Template = Object.assign(TemplateRoot, {
  Header,
  Body,
  Footer,
  Buttons,
  /** Call-to-action button that opens a URL. */
  URL: URLButton,
  /** Quick-reply button (sends its text back as a message). */
  Reply: QuickReply,
  /** Call-to-action button that dials a phone number. */
  Phone: PhoneButton,
  /** Button that opens a WhatsApp Flow. Reference a flow in this app by
   * `flowName` (id resolved at push) or pass a raw `flowId`. */
  Flow: FlowButton,
  /** Copy-code button for a coupon/offer code. */
  CopyCode: CopyCodeButton,
  /** "View catalog" button (catalog templates). */
  Catalog: CatalogButton,
  /** Marketing opt-out (unsubscribe) quick reply. */
  OptOut: OptOutButton,
  /** Authentication OTP button — copy-code variant. */
  OtpCopyCode: OtpCopyCodeButton,
  /** Authentication OTP button — one-tap autofill (Android). */
  OtpOneTap: OtpOneTapButton,
  /** Authentication OTP button — zero-tap. */
  OtpZeroTap: OtpZeroTapButton,
  /** Not implemented yet — multi-product (MPM) button. */
  MultiProduct: MultiProductButton,
  /** Not implemented yet — voice-call button. */
  VoiceCall: VoiceCallButton,
  /** Not implemented yet — app / deep-link button. */
  App: AppButton,
});

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

/** Root of a message template. Compose its parts as namespaced children:
 * `<Template.Header>`, `<Template.Body>`, `<Template.Footer>`,
 * `<Template.Buttons>` (with `<Template.URL>` / `<Template.Reply>` /
 * `<Template.Phone>` inside). Only Body is required. */
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
});

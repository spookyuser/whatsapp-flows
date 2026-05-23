import { type AuthoringChild, type AuthoringNode, node } from "whatsapp-flow-core";

type Children = AuthoringChild | AuthoringChild[];

export interface NextProps {
  /** Route of the destination screen, e.g. "/confirm". */
  to: string;
  /** Payload sent forward to the next screen. Values are usually refs. */
  data?: Record<string, unknown>;
  label?: string;
  children?: Children;
}
/** Navigate to another screen. Compiles to a `navigate` action. */
export function Next(props: NextProps): AuthoringNode {
  return node("Next", { to: props.to, data: props.data, label: props.label }, props.children);
}

export interface CompleteProps {
  /** Final payload returned when the flow completes. */
  data?: Record<string, unknown>;
  label?: string;
  children?: Children;
}
/** Terminate the flow. Compiles to a `complete` action (terminal screen). */
export function Complete(props: CompleteProps): AuthoringNode {
  return node("Complete", { data: props.data, label: props.label }, props.children);
}

export interface ExchangeProps {
  /** Optional endpoint operation name, folded into the payload as `action`. */
  action?: string;
  /** Destination screen route, used to build the routing model. */
  next?: string;
  data?: Record<string, unknown>;
  label?: string;
  children?: Children;
}
/** Exchange data with the flow endpoint. Compiles to a `data_exchange` action. */
export function Exchange(props: ExchangeProps): AuthoringNode {
  return node(
    "Exchange",
    { action: props.action, next: props.next, data: props.data, label: props.label },
    props.children,
  );
}

export interface OpenURLProps {
  url: string;
  label?: string;
  children?: Children;
}
/** Open an external URL. Compiles to an `open_url` action. */
export function OpenURL(props: OpenURLProps): AuthoringNode {
  return node("OpenURL", { url: props.url, label: props.label }, props.children);
}

export interface UpdateDataProps {
  /** Keys/values merged into the screen's data model on the client. */
  data: Record<string, unknown>;
  label?: string;
  children?: Children;
}
/** Update screen data on the client without an endpoint round-trip.
 * Compiles to an `update_data` action. */
export function UpdateData(props: UpdateDataProps): AuthoringNode {
  return node("UpdateData", { data: props.data, label: props.label }, props.children);
}

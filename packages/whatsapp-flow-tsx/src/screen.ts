import type { AuthoringNode } from "whatsapp-flow-core";

/** The shape of a screen module's default export. */
export type ScreenComponent = () => AuthoringNode;

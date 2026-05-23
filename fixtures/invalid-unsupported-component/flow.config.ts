import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "invalid_unsupported_component",
  start: "/",
  output: "flow.json",
});

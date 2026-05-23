import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "invalid_duplicate_fields",
  start: "/",
  output: "flow.json",
});

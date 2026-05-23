import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "invalid_missing_route",
  start: "/",
  output: "flow.json",
});

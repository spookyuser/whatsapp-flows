import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "all_components",
  version: "7.3",
  dataApiVersion: "3.0",
  start: "/",
  endpointUri: "https://example.com/flow",
  output: "flow.json",
});

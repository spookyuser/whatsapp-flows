import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "appointment_booking",
  version: "7.2",
  dataApiVersion: "3.0",
  start: "/",
  endpointUri: "https://example.com/flow",
  output: "flow.json",
});

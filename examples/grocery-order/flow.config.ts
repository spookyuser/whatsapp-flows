import { defineFlow } from "whatsapp-flow-tsx";

export default defineFlow({
  name: "grocery_order",
  version: "7.2",
  start: "/",
  output: "flow.json",
});

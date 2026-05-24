import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.2",
  wabas: { dev: { id: "111" }, prod: { id: "222" } },
});

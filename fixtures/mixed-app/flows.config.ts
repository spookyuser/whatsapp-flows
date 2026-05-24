import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",
  language: "en_US",
  wabas: { dev: { id: "111" }, prod: { id: "222" } },
});

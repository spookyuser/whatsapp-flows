import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",
  namePrefix: "acme_",
  language: "en_US",
  wabas: { dev: { id: "111" }, prod: { id: "222" } },
  defaultWaba: "dev",
});

import { defineFlowsApp } from "whatsapp-flow-tsx";

export default defineFlowsApp({
  version: "7.3",
  language: "en_US",
  wabas: {
    dev: { id: "2142644013223594" },
    prod: { id: "26870122239247230" },
  },
  defaultEnv: "dev",
});

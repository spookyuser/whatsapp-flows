import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

export const template = defineTemplate({ category: "UTILITY" });

export default function Notify() {
  return (
    <Template>
      <Template.Body>Your order {v("order", "A1")} is on its way.</Template.Body>
    </Template>
  );
}

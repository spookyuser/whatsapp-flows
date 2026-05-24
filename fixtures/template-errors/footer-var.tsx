import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

// Invalid: Meta footers are static — they can't carry a variable.
export const template = defineTemplate({ category: "UTILITY" });

export default function FooterVar() {
  return (
    <Template>
      <Template.Body>Your order shipped.</Template.Body>
      <Template.Footer>Sent at {v("time", "5pm")}</Template.Footer>
    </Template>
  );
}

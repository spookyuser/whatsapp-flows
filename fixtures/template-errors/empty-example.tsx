import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

// Invalid: every variable needs a non-empty example for Meta review.
export const template = defineTemplate({ category: "MARKETING" });

export default function EmptyExample() {
  return (
    <Template>
      <Template.Body>Hi {v("name", "")}, welcome.</Template.Body>
    </Template>
  );
}

import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Stubbed button: compiling MultiProduct fails with a "not implemented" error.
export const template = defineTemplate({ category: "MARKETING" });

export default function StubMpm() {
  return (
    <Template>
      <Template.Body>Browse our items.</Template.Body>
      <Template.Buttons>
        <Template.MultiProduct text="View items" />
      </Template.Buttons>
    </Template>
  );
}

import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Invalid: a "navigate" flow button needs the first screen id.
export const template = defineTemplate({ category: "UTILITY" });

export default function FlowNoScreen() {
  return (
    <Template>
      <Template.Body>Complete your booking.</Template.Body>
      <Template.Buttons>
        <Template.Flow text="Book" flowId="123" />
      </Template.Buttons>
    </Template>
  );
}

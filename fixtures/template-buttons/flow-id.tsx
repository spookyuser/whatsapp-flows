import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Flow button referencing a raw Meta flow id (a flow not authored in this app).
export const template = defineTemplate({ category: "UTILITY" });

export default function FlowId() {
  return (
    <Template>
      <Template.Body>Tap below to complete your booking.</Template.Body>
      <Template.Buttons>
        <Template.Flow text="Book now" flowId="123456789" navigateScreen="WELCOME" />
      </Template.Buttons>
    </Template>
  );
}

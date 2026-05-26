import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Invalid: a flow button takes exactly one of flowName or flowId, not both.
export const template = defineTemplate({ category: "UTILITY" });

export default function FlowBothRefs() {
  return (
    <Template>
      <Template.Body>Complete your booking.</Template.Body>
      <Template.Buttons>
        <Template.Flow text="Book" flowName="survey" flowId="123" navigateScreen="WELCOME" />
      </Template.Buttons>
    </Template>
  );
}

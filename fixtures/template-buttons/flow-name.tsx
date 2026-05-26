import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Flow button referencing a flow authored in THIS app by name; its per-env
// flow id is resolved at push time.
export const template = defineTemplate({ category: "UTILITY" });

export default function FlowName() {
  return (
    <Template>
      <Template.Body>Tap below to take our survey.</Template.Body>
      <Template.Buttons>
        <Template.Flow text="Start survey" flowName="survey" navigateScreen="WELCOME" />
      </Template.Buttons>
    </Template>
  );
}

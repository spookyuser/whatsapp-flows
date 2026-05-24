import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Invalid: a template must have exactly one <Template.Body>.
export const template = defineTemplate({ category: "MARKETING" });

export default function NoBody() {
  return (
    <Template>
      <Template.Header>Just a header</Template.Header>
    </Template>
  );
}

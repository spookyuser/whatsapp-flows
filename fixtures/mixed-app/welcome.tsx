import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

// A marketing template: header + body + footer + buttons. The variable `name`
// is reused in the header and body — each component numbers its own variables,
// so it is {{1}} in both, and its example is collected once per component.
export const template = defineTemplate({ category: "MARKETING" });

export default function Welcome() {
  const name = v("name", "Sam");
  return (
    <Template>
      <Template.Header>Welcome to Acme, {name}</Template.Header>
      <Template.Body>
        Hey {name}, you're user #{v("number", "42")}. Thanks for joining.
      </Template.Body>
      <Template.Footer>Reply STOP to unsubscribe</Template.Footer>
      <Template.Buttons>
        <Template.URL text="Open Acme" url="https://acme.com/welcome" />
        <Template.Reply>Not now</Template.Reply>
      </Template.Buttons>
    </Template>
  );
}

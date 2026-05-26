import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Stubbed button: compiling App fails with a "not implemented" error.
export const template = defineTemplate({ category: "UTILITY" });

export default function StubApp() {
  return (
    <Template>
      <Template.Body>Open the app to continue.</Template.Body>
      <Template.Buttons>
        <Template.App text="Open app" url="https://acme.com/app" />
      </Template.Buttons>
    </Template>
  );
}

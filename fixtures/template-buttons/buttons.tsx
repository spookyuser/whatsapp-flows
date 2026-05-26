import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Marketing template exercising the copy-code, opt-out, and URL buttons.
export const template = defineTemplate({ category: "MARKETING" });

export default function Buttons() {
  return (
    <Template>
      <Template.Body>Here's 10% off your next order.</Template.Body>
      <Template.Buttons>
        <Template.CopyCode code="SAVE10" />
        <Template.URL text="Shop now" url="https://acme.com/shop" />
        <Template.OptOut />
      </Template.Buttons>
    </Template>
  );
}

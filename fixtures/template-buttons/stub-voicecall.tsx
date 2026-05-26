import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Stubbed button: compiling VoiceCall fails with a "not implemented" error.
export const template = defineTemplate({ category: "UTILITY" });

export default function StubVoiceCall() {
  return (
    <Template>
      <Template.Body>We tried to reach you.</Template.Body>
      <Template.Buttons>
        <Template.VoiceCall text="Call back" />
      </Template.Buttons>
    </Template>
  );
}

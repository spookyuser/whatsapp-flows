import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Authentication template with a one-tap OTP button. Only the button payload is
// emitted; Meta validates the surrounding authentication-template structure.
export const template = defineTemplate({ category: "AUTHENTICATION" });

export default function Otp() {
  return (
    <Template>
      <Template.Body>Your verification code.</Template.Body>
      <Template.Buttons>
        <Template.OtpOneTap packageName="com.acme.app" signatureHash="K8a83b2c1d" />
      </Template.Buttons>
    </Template>
  );
}

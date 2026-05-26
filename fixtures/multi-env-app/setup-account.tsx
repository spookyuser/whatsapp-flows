import { defineTemplate, Template, v } from "whatsapp-flow-tsx";

export const template = defineTemplate({ name: "pelicart_setup_account", category: "UTILITY" });

export default function SetupAccount() {
  return (
    <Template>
      <Template.Body>
        Tap below to finish setting up your account, {v("name", "Sam")}.
      </Template.Body>
      <Template.Buttons>
        <Template.URL text="Set up" url="https://pelicart.example/setup" />
      </Template.Buttons>
    </Template>
  );
}

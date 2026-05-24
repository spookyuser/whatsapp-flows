import { defineFlow, Screen, Form, TextInput, Footer, Complete, field } from "whatsapp-flow-tsx";

// Name override beats the project namePrefix. Single screen → START.
export const flow = defineFlow({ name: "custom_login", categories: ["SIGN_IN"] });

export function Login() {
  return (
    <Screen title="Login" success>
      <Form>
        <TextInput name="email" label="Email" inputType="email" required />
        <Footer>
          <Complete data={{ email: field("email") }}>Go</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

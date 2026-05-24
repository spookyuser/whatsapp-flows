import { defineFlow, Screen, Form, TextInput, Footer, Complete, field } from "whatsapp-flow-tsx";

// Custom name overrides the filename default. Single screen → START.
export const flow = defineFlow({ name: "custom_login", categories: ["SIGN_IN"] });

export function Index() {
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

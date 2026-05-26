import { defineFlow, Screen, Form, TextInput, Footer, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({ name: "woolworths_connect", categories: ["SIGN_IN"] });

export function Index() {
  return (
    <Screen title="Connect" success>
      <Form>
        <TextInput name="account" label="Account number" required />
        <Footer>
          <Complete data={{ account: field("account") }}>Connect</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

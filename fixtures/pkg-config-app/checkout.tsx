import { defineFlow, Screen, Form, TextInput, Footer, Complete, field } from "whatsapp-flow-tsx";

export const flow = defineFlow({ categories: ["LEAD_GENERATION"] });

export function Index() {
  return (
    <Screen title="Checkout" success>
      <Form>
        <TextInput name="email" label="Email" inputType="email" required />
        <Footer>
          <Complete data={{ email: field("email") }}>Done</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

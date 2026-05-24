import { Complete, Footer, Form, Screen, TextInput, defineFlow } from "whatsapp-flow-tsx";

export const flow = defineFlow({ name: "invalid_duplicate_fields" });

export function Index() {
  return (
    <Screen title="Duplicate fields">
      <Form name="form">
        <TextInput name="email" label="Email" />
        {/* duplicate field name within the same form — must fail */}
        <TextInput name="email" label="Confirm email" />
        <Footer>
          <Complete>Submit</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

import { Screen, Form, TextInput, Footer, Complete } from "whatsapp-flow-tsx";

export default function Page() {
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

import { Screen, Form, TextInput, Footer, Next } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Start">
      <Form name="form">
        <TextInput name="email" label="Email" inputType="email" />
        <Footer>
          {/* /confirm does not exist — compilation must fail */}
          <Next to="/confirm">Continue</Next>
        </Footer>
      </Form>
    </Screen>
  );
}

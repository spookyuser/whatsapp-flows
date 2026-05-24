import { Footer, Form, Next, Screen, TextInput, defineFlow } from "whatsapp-flow-tsx";

export const flow = defineFlow({ name: "invalid_missing_route" });

export function Index() {
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

import { Screen, Form, TextInput, Footer, Next, field } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Get in touch">
      <Form name="form">
        <TextInput name="full_name" label="Your name" required />
        <TextInput name="email" label="Email" inputType="email" required />

        <Footer>
          <Next
            to="/thanks"
            data={{ full_name: field("full_name"), email: field("email") }}
          >
            Submit
          </Next>
        </Footer>
      </Form>
    </Screen>
  );
}

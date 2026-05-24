import { Screen, Form, TextInput, Footer, Next, Complete, field } from "whatsapp-flow-tsx";

// No `flow` export → name derived from filename → "signup".
// `Index` is the start ("/"); `Details` routes to "/details" (export-name → route).
export function Index() {
  return (
    <Screen title="Start">
      <Form>
        <TextInput name="name" label="Name" required />
        <Footer>
          <Next to="/details" data={{ name: field("name") }}>Next</Next>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Details() {
  return (
    <Screen title="Details" success>
      <Form>
        <TextInput name="phone" label="Phone" inputType="phone" required />
        <Footer>
          <Complete data={{ name: field("name") }}>Done</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

import {
  Screen,
  Form,
  TextInput,
  Footer,
  Exchange,
  field,
} from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Find a slot">
      <Form name="form">
        <TextInput name="postcode" label="Postcode" required />

        <Footer>
          <Exchange
            action="lookupSlots"
            next="/slots"
            data={{ postcode: field("postcode") }}
          >
            Check availability
          </Exchange>
        </Footer>
      </Form>
    </Screen>
  );
}

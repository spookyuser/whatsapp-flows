import {
  Complete,
  Exchange,
  Footer,
  Form,
  Option,
  RadioButtonsGroup,
  Screen,
  TextInput,
  defineFlow,
  field,
} from "whatsapp-flow-tsx";

export const flow = defineFlow({
  name: "appointment_booking",
  version: "7.3",
  dataApiVersion: "3.0",
  endpointUri: "https://example.com/flow",
});

export function Index() {
  return (
    <Screen title="Find a slot">
      <Form name="form">
        <TextInput name="postcode" label="Postcode" required />
        <Footer>
          <Exchange action="lookupSlots" next="/slots" data={{ postcode: field("postcode") }}>
            Check availability
          </Exchange>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Slots() {
  return (
    <Screen title="Pick a slot" data={{ slots: { type: "array", __example__: [] } }}>
      <Form name="form">
        <RadioButtonsGroup name="slot" label="Available slots" required>
          <Option id="morning" title="Morning" />
          <Option id="afternoon" title="Afternoon" />
        </RadioButtonsGroup>
        <Footer>
          <Complete data={{ slot: field("slot") }}>Book</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

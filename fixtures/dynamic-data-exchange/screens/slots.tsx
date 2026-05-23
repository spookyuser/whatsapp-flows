import {
  Screen,
  Form,
  RadioButtonsGroup,
  Option,
  Footer,
  Complete,
  field,
} from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen
      title="Pick a slot"
      data={{ slots: { type: "array", __example__: [] } }}
    >
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

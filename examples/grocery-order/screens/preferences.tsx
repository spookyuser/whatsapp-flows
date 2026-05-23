import {
  Screen,
  Form,
  Dropdown,
  Option,
  TextBody,
  Footer,
  Next,
  field,
  data,
} from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen
      title="Substitutions"
      data={{ shopping_list: { type: "string", __example__: "Milk, eggs" } }}
    >
      <Form name="form">
        <TextBody>If something is out of stock, what should we do?</TextBody>

        <Dropdown name="substitution" label="Substitution preference" required>
          <Option id="similar" title="Pick a similar item" />
          <Option id="call" title="Call me first" />
          <Option id="skip" title="Skip the item" />
        </Dropdown>

        <Footer>
          <Next
            to="/confirm"
            data={{
              shopping_list: data("shopping_list"),
              substitution: field("substitution"),
            }}
          >
            Review order
          </Next>
        </Footer>
      </Form>
    </Screen>
  );
}

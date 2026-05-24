import {
  Complete,
  Dropdown,
  Footer,
  Form,
  Next,
  Option,
  Screen,
  TextArea,
  TextBody,
  data,
  field,
} from "whatsapp-flow-tsx";

export function Index() {
  return (
    <Screen title="Start your order">
      <Form name="form">
        <TextArea name="shopping_list" label="What should we buy?" required />
        <Footer>
          <Next to="/preferences" data={{ shopping_list: field("shopping_list") }}>
            Continue
          </Next>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Preferences() {
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

export function Confirm() {
  return (
    <Screen
      title="Confirm your order"
      data={{
        shopping_list: { type: "string", __example__: "Milk, eggs" },
        substitution: { type: "string", __example__: "similar" },
      }}
    >
      <Form name="form">
        <TextBody>Please review your order before submitting.</TextBody>
        <Footer>
          <Complete
            data={{
              shopping_list: data("shopping_list"),
              substitution: data("substitution"),
            }}
          >
            Submit order
          </Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

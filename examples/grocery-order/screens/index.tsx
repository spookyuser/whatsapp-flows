import { Screen, Form, TextArea, Footer, Next, field } from "whatsapp-flow-tsx";

export default function Page() {
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

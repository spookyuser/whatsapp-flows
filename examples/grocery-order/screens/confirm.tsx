import { Screen, Form, TextBody, Footer, Complete, data } from "whatsapp-flow-tsx";

export default function Page() {
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

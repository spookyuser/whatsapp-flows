import { Screen, Form, TextBody, Footer, Complete } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Thank you">
      <Form name="form">
        <TextBody>Thanks! We'll be in touch shortly.</TextBody>
        <Footer>
          <Complete>Done</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

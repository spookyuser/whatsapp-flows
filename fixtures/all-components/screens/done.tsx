import { Screen, Form, TextBody, Footer, Complete } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="All done">
      <Form name="form">
        <TextBody>Thanks! Your submission is complete.</TextBody>
        <Footer>
          <Complete>Finish</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

import { Screen, Form, TextBody, Footer, Complete } from "whatsapp-flow-tsx";

// A plain flow living alongside the templates, to prove the project compiles a
// mixed app: this file has screen exports, so it's classified as a flow.
export function Index() {
  return (
    <Screen title="Ping" success>
      <Form>
        <TextBody>Pong.</TextBody>
        <Footer>
          <Complete>OK</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

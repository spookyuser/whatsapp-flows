// @ts-nocheck — intentionally invalid: raw HTML elements are not Flow components.
import { Screen, Form, Footer, Complete } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Unsupported">
      <Form name="form">
        <div className="oops">Raw HTML is not allowed</div>
        <Footer>
          <Complete>Submit</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

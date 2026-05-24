// @ts-nocheck — intentionally invalid: raw HTML elements are not Flow components.
import { Complete, Footer, Form, Screen, defineFlow } from "whatsapp-flow-tsx";

export const flow = defineFlow({ name: "invalid_unsupported_component" });

export function Index() {
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

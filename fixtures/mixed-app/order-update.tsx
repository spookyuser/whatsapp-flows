import { defineTemplate, Template, v, tpl } from "whatsapp-flow-tsx";

// A utility template with two body variables and a URL button whose dynamic
// suffix is the same order id — `tpl` carries the variable into the URL string.
export const template = defineTemplate({ category: "UTILITY" });

export default function OrderUpdate() {
  return (
    <Template>
      <Template.Body>
        Order {v("order", "A1234")} is on its way and should arrive by {v("eta", "5pm")}.
      </Template.Body>
      <Template.Buttons>
        <Template.URL text="Track order" url={tpl`https://acme.com/track/${v("order", "A1234")}`} />
      </Template.Buttons>
    </Template>
  );
}

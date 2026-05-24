import { defineTemplate, Template, v, tpl } from "whatsapp-flow-tsx";

// Invalid: a URL button variable must sit at the very end of the URL.
export const template = defineTemplate({ category: "UTILITY" });

export default function UrlVarNotLast() {
  return (
    <Template>
      <Template.Body>Track your order.</Template.Body>
      <Template.Buttons>
        <Template.URL text="Track" url={tpl`https://acme.com/${v("id", "A1")}/track`} />
      </Template.Buttons>
    </Template>
  );
}

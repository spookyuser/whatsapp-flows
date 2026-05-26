import { defineTemplate, Template } from "whatsapp-flow-tsx";

// Catalog template: the CATALOG button label is fixed to "View catalog".
export const template = defineTemplate({ category: "MARKETING" });

export default function Catalog() {
  return (
    <Template>
      <Template.Body>Browse our latest products.</Template.Body>
      <Template.Buttons>
        <Template.Catalog />
        <Template.OptOut text="No thanks" />
      </Template.Buttons>
    </Template>
  );
}

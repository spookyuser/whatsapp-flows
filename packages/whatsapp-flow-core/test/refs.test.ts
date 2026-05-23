import { describe, expect, it } from "vitest";
import { data, field, isRef, screenData } from "whatsapp-flow-core";

describe("reference helpers", () => {
  it("field() -> ${form.x}", () => {
    expect(field("shopping_list")).toBe("${form.shopping_list}");
  });

  it("data() -> ${data.x}", () => {
    expect(data("shopping_list")).toBe("${data.shopping_list}");
  });

  it("screenData() resolves a route to a screen id", () => {
    expect(screenData("/confirm", "summary")).toBe("${screen.CONFIRM.data.summary}");
    expect(screenData("confirm", "summary")).toBe("${screen.CONFIRM.data.summary}");
    expect(screenData("/order/edit", "qty")).toBe("${screen.ORDER_EDIT.data.qty}");
  });

  it("isRef() recognizes references", () => {
    expect(isRef(field("x"))).toBe(true);
    expect(isRef(data("x"))).toBe(true);
    expect(isRef("plain string")).toBe(false);
    expect(isRef("${broken")).toBe(false);
    expect(isRef(42)).toBe(false);
  });
});

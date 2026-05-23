import { describe, expect, it } from "vitest";
import { normalizeRoute, routeToFilePath, routeToScreenId } from "whatsapp-flow-core";

describe("routeToScreenId", () => {
  it("maps the root to START", () => {
    expect(routeToScreenId("/")).toBe("START");
    expect(routeToScreenId("")).toBe("START");
  });

  it("upper-snake-cases routes", () => {
    expect(routeToScreenId("/preferences")).toBe("PREFERENCES");
    expect(routeToScreenId("/order/edit")).toBe("ORDER_EDIT");
    expect(routeToScreenId("confirm")).toBe("CONFIRM");
  });
});

describe("normalizeRoute", () => {
  it("adds a leading slash and trims trailing", () => {
    expect(normalizeRoute("preferences")).toBe("/preferences");
    expect(normalizeRoute("/preferences/")).toBe("/preferences");
    expect(normalizeRoute("/")).toBe("/");
  });
});

describe("routeToFilePath", () => {
  it("guesses the screen file", () => {
    expect(routeToFilePath("/")).toBe("screens/index.tsx");
    expect(routeToFilePath("/confirm")).toBe("screens/confirm.tsx");
    expect(routeToFilePath("/order/edit")).toBe("screens/order/edit.tsx");
  });
});

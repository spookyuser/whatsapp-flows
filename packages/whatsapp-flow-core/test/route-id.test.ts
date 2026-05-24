import { describe, expect, it } from "vitest";
import { normalizeRoute, routeToScreenId } from "whatsapp-flow-core";

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

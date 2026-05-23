import { describe, expect, it } from "vitest";
import { isAuthoringNode } from "whatsapp-flow-core";
import { Screen, TextBody } from "whatsapp-flow-tsx";
import { Fragment, jsx } from "whatsapp-flow-tsx/jsx-runtime";

describe("jsx runtime", () => {
  it("invokes function components into AST nodes", () => {
    const n = jsx(TextBody, { text: "hi" });
    expect(isAuthoringNode(n)).toBe(true);
    expect(n.component).toBe("TextBody");
    expect(n.props.text).toBe("hi");
    expect(n.children).toEqual([]);
  });

  it("flattens fragments", () => {
    const n = jsx(Fragment, {
      children: [jsx(TextBody, { text: "a" }), jsx(TextBody, { text: "b" })],
    });
    expect(n.component).toBe("#fragment");
    expect(n.children).toHaveLength(2);
  });

  it("rejects raw host elements", () => {
    expect(() => jsx("div", {})).toThrow(/Raw element <div>/);
  });

  it("builds nested trees from JSX syntax", () => {
    const tree = (
      <Screen title="t">
        <TextBody text="x" />
      </Screen>
    );
    expect(tree.component).toBe("Screen");
    expect(tree.props.title).toBe("t");
    expect(tree.children[0]?.component).toBe("TextBody");
  });

  it("turns string children into #text nodes", () => {
    const tree = jsx(TextBody, { children: "hello" });
    expect(tree.children[0]?.component).toBe("#text");
    expect(tree.children[0]?.props.value).toBe("hello");
  });
});

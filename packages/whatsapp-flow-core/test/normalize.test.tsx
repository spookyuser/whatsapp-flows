import { describe, expect, it } from "vitest";
import { node, normalizeScreen } from "whatsapp-flow-core";
import {
  Complete,
  Dropdown,
  Footer,
  Form,
  Next,
  Option,
  Screen,
  TextArea,
  TextInput,
  field,
} from "whatsapp-flow-tsx";

const resolver = (map: Record<string, string>) => (route: string) => map[route] ?? null;

describe("normalizeScreen", () => {
  it("normalizes a form screen with a navigate footer", () => {
    const root = (
      <Screen title="Start your order">
        <Form name="form">
          <TextArea name="shopping_list" label="What should we buy?" required />
          <Footer>
            <Next to="/preferences" data={{ shopping_list: field("shopping_list") }}>
              Continue
            </Next>
          </Footer>
        </Form>
      </Screen>
    );

    const result = normalizeScreen(root, {
      route: "/",
      id: "START",
      resolveRoute: resolver({ "/preferences": "PREFERENCES" }),
    });

    expect(result.terminal).toBe(false);
    expect(result.edges).toEqual(["PREFERENCES"]);
    expect(result.screen).toEqual({
      id: "START",
      title: "Start your order",
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "Form",
            name: "form",
            children: [
              {
                type: "TextArea",
                name: "shopping_list",
                label: "What should we buy?",
                required: true,
              },
              {
                type: "Footer",
                label: "Continue",
                "on-click-action": {
                  name: "navigate",
                  next: { type: "screen", name: "PREFERENCES" },
                  payload: { shopping_list: "${form.shopping_list}" },
                },
              },
            ],
          },
        ],
      },
    });
  });

  it("maps Dropdown <Option> children to data-source items", () => {
    const root = (
      <Screen title="Pick">
        <Form name="form">
          <Dropdown name="choice" label="Choose">
            <Option id="a" title="A" />
            <Option title="B" />
          </Dropdown>
          <Footer>
            <Complete>Done</Complete>
          </Footer>
        </Form>
      </Screen>
    );
    const { screen } = normalizeScreen(root, {
      route: "/",
      id: "START",
      resolveRoute: resolver({}),
    });
    const form = screen.layout.children[0] as { children: unknown[] };
    expect(form.children[0]).toEqual({
      type: "Dropdown",
      name: "choice",
      label: "Choose",
      "data-source": [
        { id: "a", title: "A" },
        { id: "1", title: "B" },
      ],
    });
  });

  it("infers terminal from a Complete action", () => {
    const root = (
      <Screen title="Done">
        <Form name="form">
          <Footer>
            <Complete data={{ ok: true }}>Submit</Complete>
          </Footer>
        </Form>
      </Screen>
    );
    const result = normalizeScreen(root, {
      route: "/done",
      id: "DONE",
      resolveRoute: resolver({}),
    });
    expect(result.terminal).toBe(true);
    expect(result.completes).toBe(true);
    expect(result.screen.terminal).toBe(true);
  });

  it("errors when a Footer has no action", () => {
    const root = (
      <Screen title="x">
        <Form name="form">
          <Footer>nothing</Footer>
        </Form>
      </Screen>
    );
    expect(() =>
      normalizeScreen(root, { route: "/x", id: "X", resolveRoute: resolver({}) }),
    ).toThrow(/must contain exactly one action/);
  });

  it("errors on duplicate field names within a form", () => {
    const root = (
      <Screen title="x">
        <Form name="form">
          <TextInput name="email" label="Email" />
          <TextInput name="email" label="Email again" />
          <Footer>
            <Complete>Go</Complete>
          </Footer>
        </Form>
      </Screen>
    );
    expect(() =>
      normalizeScreen(root, { route: "/x", id: "X", resolveRoute: resolver({}) }),
    ).toThrow(/more than one field named "email"/);
  });

  it("errors when an input is not inside a form", () => {
    const root = (
      <Screen title="x">
        <TextInput name="email" label="Email" />
      </Screen>
    );
    expect(() =>
      normalizeScreen(root, { route: "/x", id: "X", resolveRoute: resolver({}) }),
    ).toThrow(/must be placed inside a <Form>/);
  });

  it("errors with a readable message on a missing route", () => {
    const root = (
      <Screen title="x">
        <Form name="form">
          <Footer>
            <Next to="/confirm">Continue</Next>
          </Footer>
        </Form>
      </Screen>
    );
    expect(() =>
      normalizeScreen(root, {
        route: "/preferences",
        id: "PREFERENCES",
        resolveRoute: resolver({}),
      }),
    ).toThrow(/no screen exports that route/);
  });

  it("rejects unsupported components", () => {
    const root = node("Screen", { title: "x" }, [node("Marquee", {})]);
    expect(() =>
      normalizeScreen(root, { route: "/x", id: "X", resolveRoute: resolver({}) }),
    ).toThrow(/<Marquee> is not a supported Flow component/);
  });
});

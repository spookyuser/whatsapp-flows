import { describe, expect, it } from "vitest";
import { normalizeScreen } from "whatsapp-flow-core";
import {
  CalendarPicker,
  CarouselImage,
  Case,
  CheckboxGroup,
  ChipsSelector,
  Complete,
  DatePicker,
  Default,
  DocumentPicker,
  Dropdown,
  Else,
  EmbeddedLink,
  Exchange,
  Footer,
  Form,
  If,
  Image,
  ImageCarousel,
  NavItem,
  NavigationList,
  Next,
  OpenURL,
  OptIn,
  Option,
  PhotoPicker,
  RadioButtonsGroup,
  RichText,
  Screen,
  Switch,
  TextArea,
  TextBody,
  TextCaption,
  TextHeading,
  TextInput,
  TextSubheading,
  UpdateData,
  field,
} from "whatsapp-flow-tsx";

const resolve =
  (m: Record<string, string> = {}) =>
  (r: string): string | null =>
    m[r] ?? null;

type Any = Record<string, unknown>;

function inForm(child: unknown, routes: Record<string, string> = {}): Any {
  const root = (
    <Screen title="t">
      <Form name="form">{child as never}</Form>
    </Screen>
  );
  const { screen } = normalizeScreen(root, {
    route: "/",
    id: "START",
    resolveRoute: resolve(routes),
  });
  const form = screen.layout.children[0] as Any;
  return (form.children as Any[])[0] as Any;
}

function inLayout(child: unknown, routes: Record<string, string> = {}): Any {
  const root = <Screen title="t">{child as never}</Screen>;
  const { screen } = normalizeScreen(root, {
    route: "/",
    id: "START",
    resolveRoute: resolve(routes),
  });
  return screen.layout.children[0] as Any;
}

describe("display components", () => {
  it("TextHeading / TextSubheading", () => {
    expect(inLayout(<TextHeading text="H" />)).toEqual({ type: "TextHeading", text: "H" });
    expect(inLayout(<TextSubheading text="S" />)).toEqual({
      type: "TextSubheading",
      text: "S",
    });
  });

  it("TextBody with markdown / font-weight / strikethrough", () => {
    expect(inLayout(<TextBody text="B" markdown fontWeight="bold" strikethrough />)).toEqual({
      type: "TextBody",
      text: "B",
      markdown: true,
      "font-weight": "bold",
      strikethrough: true,
    });
  });

  it("TextBody can take text from children", () => {
    expect(inLayout(<TextBody>Hello</TextBody>)).toEqual({ type: "TextBody", text: "Hello" });
  });

  it("TextCaption", () => {
    expect(inLayout(<TextCaption text="C" />)).toEqual({ type: "TextCaption", text: "C" });
  });

  it("RichText supports a text array", () => {
    expect(inLayout(<RichText text={["# A", "b"]} />)).toEqual({
      type: "RichText",
      text: ["# A", "b"],
    });
  });

  it("Image maps camelCase to kebab-case", () => {
    expect(
      inLayout(<Image src="data" width={10} height={20} scaleType="contain" altText="x" />),
    ).toEqual({
      type: "Image",
      src: "data",
      width: 10,
      height: 20,
      "scale-type": "contain",
      "alt-text": "x",
    });
  });

  it("ImageCarousel maps <CarouselImage> children to alt-text", () => {
    expect(
      inLayout(
        <ImageCarousel>
          <CarouselImage src="a" altText="x" />
          <CarouselImage src="b" />
        </ImageCarousel>,
      ),
    ).toEqual({
      type: "ImageCarousel",
      images: [{ src: "a", "alt-text": "x" }, { src: "b" }],
    });
  });

  it("EmbeddedLink with an open_url action", () => {
    expect(
      inLayout(<EmbeddedLink text="link" onClickAction={<OpenURL url="https://x" />} />),
    ).toEqual({
      type: "EmbeddedLink",
      text: "link",
      "on-click-action": { name: "open_url", url: "https://x" },
    });
  });
});

describe("input components", () => {
  it("TextInput with input-type + pattern", () => {
    expect(
      inForm(<TextInput name="email" label="Email" inputType="email" pattern=".+" required />),
    ).toEqual({
      type: "TextInput",
      name: "email",
      label: "Email",
      "input-type": "email",
      pattern: ".+",
      required: true,
    });
  });

  it("TextArea with max-length", () => {
    expect(inForm(<TextArea name="n" label="N" maxLength={100} />)).toEqual({
      type: "TextArea",
      name: "n",
      label: "N",
      "max-length": 100,
    });
  });

  it("Dropdown with full data-source items and on-select-action", () => {
    expect(
      inForm(
        <Dropdown name="d" label="D" onSelectAction={<UpdateData data={{ x: field("d") }} />}>
          <Option id="a" title="A" description="desc" metadata="m" enabled={false} altText="alt" />
          <Option title="B" />
        </Dropdown>,
      ),
    ).toEqual({
      type: "Dropdown",
      name: "d",
      label: "D",
      "data-source": [
        {
          id: "a",
          title: "A",
          description: "desc",
          metadata: "m",
          enabled: false,
          "alt-text": "alt",
        },
        { id: "1", title: "B" },
      ],
      "on-select-action": { name: "update_data", payload: { x: "${form.d}" } },
    });
  });

  it("RadioButtonsGroup with media-size", () => {
    expect(
      inForm(
        <RadioButtonsGroup name="r" label="R" mediaSize="large">
          <Option id="a" title="A" />
        </RadioButtonsGroup>,
      ),
    ).toEqual({
      type: "RadioButtonsGroup",
      name: "r",
      label: "R",
      "data-source": [{ id: "a", title: "A" }],
      "media-size": "large",
    });
  });

  it("CheckboxGroup with min/max/init", () => {
    expect(
      inForm(
        <CheckboxGroup
          name="c"
          label="C"
          minSelectedItems={1}
          maxSelectedItems={2}
          initValue={["a"]}
        >
          <Option id="a" title="A" />
        </CheckboxGroup>,
      ),
    ).toEqual({
      type: "CheckboxGroup",
      name: "c",
      label: "C",
      "data-source": [{ id: "a", title: "A" }],
      "min-selected-items": 1,
      "max-selected-items": 2,
      "init-value": ["a"],
    });
  });

  it("ChipsSelector", () => {
    expect(
      inForm(
        <ChipsSelector name="ch" label="Ch">
          <Option id="a" title="A" />
        </ChipsSelector>,
      ),
    ).toEqual({
      type: "ChipsSelector",
      name: "ch",
      label: "Ch",
      "data-source": [{ id: "a", title: "A" }],
    });
  });

  it("OptIn with on-click-action", () => {
    expect(
      inForm(
        <OptIn name="tos" label="Agree" required onClickAction={<OpenURL url="https://t" />} />,
      ),
    ).toEqual({
      type: "OptIn",
      name: "tos",
      label: "Agree",
      required: true,
      "on-click-action": { name: "open_url", url: "https://t" },
    });
  });

  it("DatePicker with unavailable-dates", () => {
    expect(
      inForm(
        <DatePicker name="d" label="D" minDate="2026-01-01" unavailableDates={["2026-01-02"]} />,
      ),
    ).toEqual({
      type: "DatePicker",
      name: "d",
      label: "D",
      "min-date": "2026-01-01",
      "unavailable-dates": ["2026-01-02"],
    });
  });

  it("CalendarPicker with mode and include-days", () => {
    expect(
      inForm(<CalendarPicker name="c" label="C" mode="range" includeDays={["Mon", "Tue"]} />),
    ).toEqual({
      type: "CalendarPicker",
      name: "c",
      label: "C",
      mode: "range",
      "include-days": ["Mon", "Tue"],
    });
  });

  it("PhotoPicker", () => {
    expect(
      inForm(
        <PhotoPicker
          name="p"
          label="P"
          photoSource="gallery"
          minUploadedPhotos={1}
          maxFileSizeKb={1024}
        />,
      ),
    ).toEqual({
      type: "PhotoPicker",
      name: "p",
      label: "P",
      "photo-source": "gallery",
      "min-uploaded-photos": 1,
      "max-file-size-kb": 1024,
    });
  });

  it("DocumentPicker with allowed-mime-types", () => {
    expect(
      inForm(<DocumentPicker name="doc" label="Doc" allowedMimeTypes={["application/pdf"]} />),
    ).toEqual({
      type: "DocumentPicker",
      name: "doc",
      label: "Doc",
      "allowed-mime-types": ["application/pdf"],
    });
  });
});

describe("structural components", () => {
  it("Footer captions and enabled", () => {
    const footer = inForm(
      <Footer leftCaption="L" centerCaption="C" rightCaption="R" enabled={false}>
        <Complete>Go</Complete>
      </Footer>,
    );
    expect(footer).toEqual({
      type: "Footer",
      label: "Go",
      "on-click-action": { name: "complete" },
      "left-caption": "L",
      "center-caption": "C",
      "right-caption": "R",
      enabled: false,
    });
  });

  it("If with then and Else child", () => {
    expect(
      inLayout(
        <If condition="${data.x}">
          <TextBody text="yes" />
          <Else>
            <TextBody text="no" />
          </Else>
        </If>,
      ),
    ).toEqual({
      type: "If",
      condition: "${data.x}",
      then: [{ type: "TextBody", text: "yes" }],
      else: [{ type: "TextBody", text: "no" }],
    });
  });

  it("Switch with Case children and a Default fallback", () => {
    expect(
      inLayout(
        <Switch value="${data.c}">
          <Case value="a">
            <TextBody text="A" />
          </Case>
          <Case value="b">
            <TextBody text="B" />
          </Case>
          <Default>
            <TextBody text="?" />
          </Default>
        </Switch>,
      ),
    ).toEqual({
      type: "Switch",
      value: "${data.c}",
      cases: {
        a: [{ type: "TextBody", text: "A" }],
        b: [{ type: "TextBody", text: "B" }],
        default: [{ type: "TextBody", text: "?" }],
      },
    });
  });

  it("NavigationList builds list-items and resolves a navigate action", () => {
    const nav = inLayout(
      <NavigationList name="m" label="Menu" mediaSize="regular" onClickAction={<Next to="/done" />}>
        <NavItem id="a" title="A" description="d" metadata="x" image="img" tags={["t"]} />
      </NavigationList>,
      { "/done": "DONE" },
    );
    expect(nav).toEqual({
      type: "NavigationList",
      name: "m",
      label: "Menu",
      "media-size": "regular",
      "list-items": [
        {
          id: "a",
          "main-content": { title: "A", description: "d", metadata: "x" },
          start: { image: "img" },
          tags: ["t"],
        },
      ],
      "on-click-action": { name: "navigate", next: { type: "screen", name: "DONE" } },
    });
  });
});

describe("actions", () => {
  const action = (child: unknown, routes: Record<string, string> = {}): Any =>
    inForm(<Footer>{child as never}</Footer>, routes)["on-click-action"] as Any;

  it("Next -> navigate with payload", () => {
    expect(
      action(
        <Next to="/x" data={{ a: field("a") }}>
          Go
        </Next>,
        { "/x": "X" },
      ),
    ).toEqual({
      name: "navigate",
      next: { type: "screen", name: "X" },
      payload: { a: "${form.a}" },
    });
  });

  it("Complete -> complete", () => {
    expect(action(<Complete data={{ done: true }}>Done</Complete>)).toEqual({
      name: "complete",
      payload: { done: true },
    });
  });

  it("Exchange -> data_exchange with folded action name", () => {
    expect(
      action(
        <Exchange action="op" data={{ a: field("a") }}>
          Go
        </Exchange>,
      ),
    ).toEqual({
      name: "data_exchange",
      payload: { action: "op", a: "${form.a}" },
    });
  });
});

describe("enum + required validation", () => {
  it("rejects an invalid input-type", () => {
    expect(() => inForm(<TextInput name="n" label="L" inputType={"bogus" as never} />)).toThrow(
      /inputType.*must be one of/,
    );
  });

  it("rejects an invalid photo-source", () => {
    expect(() => inForm(<PhotoPicker name="p" label="P" photoSource={"x" as never} />)).toThrow(
      /photoSource.*must be one of/,
    );
  });

  it("requires src on Image", () => {
    expect(() => inLayout(<Image src={undefined as never} />)).toThrow(/missing required "src"/);
  });
});

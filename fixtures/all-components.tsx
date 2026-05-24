import {
  CalendarPicker,
  CarouselImage,
  Case,
  CheckboxGroup,
  ChipsSelector,
  Complete,
  DatePicker,
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
  defineFlow,
  field,
} from "whatsapp-flow-tsx";

export const flow = defineFlow({
  name: "all_components",
  version: "7.3",
  dataApiVersion: "3.0",
  endpointUri: "https://example.com/flow",
});

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function Index() {
  return (
    <Screen title="Everything">
      <TextHeading>Heading</TextHeading>
      <TextSubheading>Subheading</TextSubheading>
      <TextBody markdown fontWeight="bold" strikethrough={false}>
        Body text
      </TextBody>
      <TextCaption>Caption</TextCaption>
      <RichText text={["# Title", "Some **bold** text"]} />
      <Image src={PNG} width={200} height={200} scaleType="contain" altText="dot" />
      <ImageCarousel scaleType="cover">
        <CarouselImage src={PNG} altText="one" />
        <CarouselImage src={PNG} altText="two" />
      </ImageCarousel>
      <EmbeddedLink onClickAction={<OpenURL url="https://example.com/info" />}>
        Learn more
      </EmbeddedLink>

      <Form name="form">
        <TextInput name="full_name" label="Name" inputType="text" required pattern=".+" />
        <TextArea name="notes" label="Notes" maxLength={500} />
        <Dropdown
          name="size"
          label="Size"
          onSelectAction={<UpdateData data={{ chosen_size: field("size") }} />}
        >
          <Option id="s" title="Small" />
          <Option id="m" title="Medium" />
          <Option id="l" title="Large" />
        </Dropdown>
        <RadioButtonsGroup name="color" label="Color" mediaSize="regular">
          <Option id="red" title="Red" />
          <Option id="blue" title="Blue" />
        </RadioButtonsGroup>
        <CheckboxGroup
          name="toppings"
          label="Toppings"
          minSelectedItems={1}
          maxSelectedItems={3}
          initValue={["cheese"]}
        >
          <Option id="cheese" title="Cheese" />
          <Option id="olives" title="Olives" />
        </CheckboxGroup>
        <ChipsSelector name="extras" label="Extras" maxSelectedItems={2}>
          <Option id="fast" title="Fast" />
          <Option id="gift" title="Gift wrap" />
        </ChipsSelector>
        <DatePicker name="delivery_date" label="Delivery date" minDate="2026-01-01" />
        <CalendarPicker name="stay" label="Stay" mode="range" />
        <OptIn
          name="tos"
          label="I agree to the terms"
          required
          onClickAction={<OpenURL url="https://example.com/terms" />}
        />

        <If condition="${form.tos}">
          <TextBody>Thanks for agreeing.</TextBody>
          <Else>
            <TextCaption>Please agree to continue.</TextCaption>
          </Else>
        </If>
        <Switch value="${form.color}">
          <Case value="red">
            <TextBody>You picked red</TextBody>
          </Case>
          <Case value="blue">
            <TextBody>You picked blue</TextBody>
          </Case>
        </Switch>

        <Footer>
          <Next to="/upload" data={{ full_name: field("full_name") }}>
            Continue
          </Next>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Upload() {
  return (
    <Screen title="Upload" data={{ full_name: { type: "string", __example__: "Sam" } }}>
      <Form name="form">
        <PhotoPicker
          name="photos"
          label="Upload photos"
          photoSource="camera_gallery"
          minUploadedPhotos={1}
          maxUploadedPhotos={5}
          maxFileSizeKb={10240}
        />
        <DocumentPicker
          name="docs"
          label="Upload documents"
          allowedMimeTypes={["application/pdf"]}
          maxFileSizeKb={5120}
        />
        <Footer>
          <Exchange action="processUploads" next="/menu" data={{ photos: field("photos") }}>
            Upload
          </Exchange>
        </Footer>
      </Form>
    </Screen>
  );
}

export function Menu() {
  return (
    <Screen title="Choose">
      <TextHeading>Pick an option</TextHeading>
      <NavigationList
        name="menu"
        label="Options"
        mediaSize="large"
        onClickAction={<Next to="/done" />}
      >
        <NavItem id="a" title="Option A" description="First" metadata="meta" tags={["new"]} />
        <NavItem id="b" title="Option B" description="Second" />
      </NavigationList>
    </Screen>
  );
}

export function Done() {
  return (
    <Screen title="All done">
      <Form name="form">
        <TextBody>Thanks! Your submission is complete.</TextBody>
        <Footer>
          <Complete>Finish</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

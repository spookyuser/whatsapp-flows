import {
  Screen,
  Form,
  TextHeading,
  TextSubheading,
  TextBody,
  TextCaption,
  RichText,
  Image,
  ImageCarousel,
  CarouselImage,
  EmbeddedLink,
  TextInput,
  TextArea,
  Dropdown,
  Option,
  RadioButtonsGroup,
  CheckboxGroup,
  ChipsSelector,
  OptIn,
  DatePicker,
  CalendarPicker,
  If,
  Else,
  Switch,
  Case,
  Footer,
  Next,
  OpenURL,
  UpdateData,
  field,
} from "whatsapp-flow-tsx";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export default function Page() {
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

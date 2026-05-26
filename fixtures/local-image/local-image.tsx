import {
  CarouselImage,
  Complete,
  Footer,
  Form,
  Image,
  ImageCarousel,
  Screen,
  defineFlow,
} from "whatsapp-flow-tsx";

export const flow = defineFlow({ name: "local_image", version: "7.3" });

export function Index() {
  return (
    <Screen title="Pic">
      <Form name="form">
        {/* relative path → resolved against this flow file's directory */}
        <Image src="dot.png" altText="dot" />
        <ImageCarousel scaleType="cover">
          <CarouselImage src="./dot.png" altText="one" />
        </ImageCarousel>
        <Footer>
          <Complete>Done</Complete>
        </Footer>
      </Form>
    </Screen>
  );
}

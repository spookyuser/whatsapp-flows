import { Screen, Form, Image, ImageCarousel, CarouselImage, Footer, Complete } from "whatsapp-flow-tsx";

export default function Page() {
  return (
    <Screen title="Pic">
      <Form name="form">
        {/* relative path → resolved against this screen file's directory */}
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

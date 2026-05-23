import {
  Screen,
  Form,
  PhotoPicker,
  DocumentPicker,
  Footer,
  Exchange,
  field,
} from "whatsapp-flow-tsx";

export default function Page() {
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

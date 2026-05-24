import { type AuthoringChild, type AuthoringNode, node } from "whatsapp-flow-core";

type Children = AuthoringChild | AuthoringChild[];
interface WithChildren {
  children?: Children;
}
/** An action node, e.g. the result of <Next/>, <Exchange/>, <UpdateData/>. */
type Action = AuthoringNode;

function el(component: string, props: object): AuthoringNode {
  return node(
    component,
    props as Record<string, unknown>,
    (props as WithChildren).children,
  );
}

// --- Structure -------------------------------------------------------------

export interface ScreenProps extends WithChildren {
  title?: string;
  terminal?: boolean;
  success?: boolean;
  data?: Record<string, unknown>;
}
export function Screen(props: ScreenProps): AuthoringNode {
  return el("Screen", props);
}

export type LayoutProps = WithChildren;
export function SingleColumnLayout(props: LayoutProps): AuthoringNode {
  return el("SingleColumnLayout", props);
}
export const Layout = SingleColumnLayout;

export interface FormProps extends WithChildren {
  name?: string;
}
export function Form(props: FormProps): AuthoringNode {
  return el("Form", props);
}

export interface FooterProps extends WithChildren {
  label?: string;
  leftCaption?: string;
  centerCaption?: string;
  rightCaption?: string;
  enabled?: boolean | string;
}
export function Footer(props: FooterProps): AuthoringNode {
  return el("Footer", props);
}

export interface IfProps extends WithChildren {
  condition: string;
}
/** Render its children when `condition` is true. Add an `<Else>` child for the
 * false branch. */
export function If(props: IfProps): AuthoringNode {
  return el("If", props);
}

export type ElseProps = WithChildren;
/** The false branch of an `<If>`. */
export function Else(props: ElseProps): AuthoringNode {
  return el("Else", props);
}

export interface SwitchProps extends WithChildren {
  value: string;
}
/** Render one branch based on `value`. Compose `<Case value="…">` children and
 * an optional `<Default>` fallback. */
export function Switch(props: SwitchProps): AuthoringNode {
  return el("Switch", props);
}

export interface CaseProps extends WithChildren {
  value: string;
}
/** A `<Switch>` branch matched when the switch value equals `value`. */
export function Case(props: CaseProps): AuthoringNode {
  return el("Case", props);
}

export type DefaultProps = WithChildren;
/** The fallback branch of a `<Switch>` when no `<Case>` matches. */
export function Default(props: DefaultProps): AuthoringNode {
  return el("Default", props);
}

// --- Text / display --------------------------------------------------------

export type FontWeight = "bold" | "italic" | "bold_italic" | "normal";

export interface HeadingProps extends WithChildren {
  text?: string;
  visible?: boolean | string;
}
export function TextHeading(props: HeadingProps): AuthoringNode {
  return el("TextHeading", props);
}
export function TextSubheading(props: HeadingProps): AuthoringNode {
  return el("TextSubheading", props);
}

export interface BodyTextProps extends WithChildren {
  text?: string | string[];
  markdown?: boolean;
  fontWeight?: FontWeight;
  strikethrough?: boolean;
  visible?: boolean | string;
}
export function TextBody(props: BodyTextProps): AuthoringNode {
  return el("TextBody", props);
}
export function TextCaption(props: BodyTextProps): AuthoringNode {
  return el("TextCaption", props);
}

export interface RichTextProps extends WithChildren {
  text?: string | string[];
  visible?: boolean | string;
}
export function RichText(props: RichTextProps): AuthoringNode {
  return el("RichText", props);
}

export type ScaleType = "contain" | "cover";

export interface ImageProps {
  /** Image data. A local file path or http(s)/file URL is automatically
   * base64-encoded at compile time (relative paths resolve against the screen
   * file). A bare base64 string is also accepted as-is. */
  src: string;
  width?: number;
  height?: number;
  scaleType?: ScaleType;
  aspectRatio?: number;
  altText?: string;
  visible?: boolean | string;
}
export function Image(props: ImageProps): AuthoringNode {
  return el("Image", props);
}

export interface ImageCarouselProps extends WithChildren {
  scaleType?: ScaleType;
  aspectRatio?: number;
  visible?: boolean | string;
}
/** A carousel of images. Compose `<CarouselImage>` children. */
export function ImageCarousel(props: ImageCarouselProps): AuthoringNode {
  return el("ImageCarousel", props);
}

export interface CarouselImageProps {
  /** Image data. A local file path or http(s)/file URL is automatically
   * base64-encoded at compile time; a bare base64 string is accepted as-is. */
  src: string;
  altText?: string;
}
export function CarouselImage(props: CarouselImageProps): AuthoringNode {
  return el("CarouselImage", props);
}

export interface EmbeddedLinkProps extends WithChildren {
  text?: string;
  onClickAction: Action;
  visible?: boolean | string;
}
export function EmbeddedLink(props: EmbeddedLinkProps): AuthoringNode {
  return el("EmbeddedLink", props);
}

// --- Inputs ----------------------------------------------------------------

export type InputType = "text" | "number" | "email" | "password" | "passcode" | "phone";

export interface TextInputProps {
  name: string;
  label: string;
  inputType?: InputType;
  pattern?: string;
  required?: boolean;
  minChars?: number;
  maxChars?: number;
  helperText?: string;
  initValue?: string;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function TextInput(props: TextInputProps): AuthoringNode {
  return el("TextInput", props);
}

export interface TextAreaProps {
  name: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  helperText?: string;
  initValue?: string;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function TextArea(props: TextAreaProps): AuthoringNode {
  return el("TextArea", props);
}

export interface OptionProps extends WithChildren {
  id?: string;
  /** Visible label. May be supplied as text children instead. */
  title?: string;
  description?: string;
  metadata?: string;
  enabled?: boolean;
  image?: string;
  altText?: string;
}
/** A single choice inside a `<Dropdown>`, `<RadioButtonsGroup>`,
 * `<CheckboxGroup>`, or `<ChipsSelector>`. */
export function Option(props: OptionProps): AuthoringNode {
  return el("Option", props);
}
export type MediaSize = "regular" | "large";

export interface DropdownProps extends WithChildren {
  name: string;
  label: string;
  required?: boolean;
  initValue?: string;
  onSelectAction?: Action;
  onUnselectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function Dropdown(props: DropdownProps): AuthoringNode {
  return el("Dropdown", props);
}

export interface RadioButtonsGroupProps extends WithChildren {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  initValue?: string;
  mediaSize?: MediaSize;
  onSelectAction?: Action;
  onUnselectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function RadioButtonsGroup(props: RadioButtonsGroupProps): AuthoringNode {
  return el("RadioButtonsGroup", props);
}

export interface CheckboxGroupProps extends WithChildren {
  name: string;
  label: string;
  description?: string;
  minSelectedItems?: number;
  maxSelectedItems?: number;
  required?: boolean;
  initValue?: string[];
  mediaSize?: MediaSize;
  onSelectAction?: Action;
  onUnselectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function CheckboxGroup(props: CheckboxGroupProps): AuthoringNode {
  return el("CheckboxGroup", props);
}

export interface ChipsSelectorProps extends WithChildren {
  name: string;
  label: string;
  description?: string;
  minSelectedItems?: number;
  maxSelectedItems?: number;
  required?: boolean;
  initValue?: string[];
  onSelectAction?: Action;
  onUnselectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
}
export function ChipsSelector(props: ChipsSelectorProps): AuthoringNode {
  return el("ChipsSelector", props);
}

export interface OptInProps {
  name: string;
  label: string;
  required?: boolean;
  initValue?: boolean;
  onClickAction?: Action;
  visible?: boolean | string;
}
export function OptIn(props: OptInProps): AuthoringNode {
  return el("OptIn", props);
}

export interface DatePickerProps {
  name: string;
  label: string;
  minDate?: string;
  maxDate?: string;
  unavailableDates?: string[];
  helperText?: string;
  initValue?: string;
  required?: boolean;
  onSelectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
}
export function DatePicker(props: DatePickerProps): AuthoringNode {
  return el("DatePicker", props);
}

export type CalendarMode = "single" | "range";
export interface CalendarPickerProps {
  name: string;
  label: string | Record<string, string>;
  mode?: CalendarMode;
  minDate?: string;
  maxDate?: string;
  unavailableDates?: string[];
  includeDays?: string[];
  helperText?: string;
  required?: boolean;
  onSelectAction?: Action;
  enabled?: boolean | string;
  visible?: boolean | string;
}
export function CalendarPicker(props: CalendarPickerProps): AuthoringNode {
  return el("CalendarPicker", props);
}

export type PhotoSource = "camera_gallery" | "camera" | "gallery";
export interface PhotoPickerProps {
  name: string;
  label: string;
  description?: string;
  photoSource?: PhotoSource;
  maxFileSizeKb?: number;
  minUploadedPhotos?: number;
  maxUploadedPhotos?: number;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function PhotoPicker(props: PhotoPickerProps): AuthoringNode {
  return el("PhotoPicker", props);
}

export interface DocumentPickerProps {
  name: string;
  label: string;
  description?: string;
  allowedMimeTypes?: string[];
  maxFileSizeKb?: number;
  minUploadedDocuments?: number;
  maxUploadedDocuments?: number;
  enabled?: boolean | string;
  visible?: boolean | string;
  errorMessage?: string;
}
export function DocumentPicker(props: DocumentPickerProps): AuthoringNode {
  return el("DocumentPicker", props);
}

// --- NavigationList --------------------------------------------------------

export interface NavigationListProps extends WithChildren {
  name: string;
  label?: string;
  description?: string;
  mediaSize?: MediaSize;
  /** Default action for items that don't define their own `onClickAction`. */
  onClickAction?: Action;
  visible?: boolean | string;
}
/** A tappable list. Compose `<NavItem>` children. */
export function NavigationList(props: NavigationListProps): AuthoringNode {
  return el("NavigationList", props);
}

export interface NavItemProps extends WithChildren {
  id?: string;
  /** Item title. May be supplied as text children instead. */
  title?: string;
  description?: string;
  metadata?: string;
  image?: string;
  badge?: string;
  tags?: string[];
  onClickAction?: Action;
}
/** A single entry in a `<NavigationList>`. */
export function NavItem(props: NavItemProps): AuthoringNode {
  return el("NavItem", props);
}

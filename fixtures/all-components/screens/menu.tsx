import { Screen, TextHeading, NavigationList, NavItem, Next } from "whatsapp-flow-tsx";

export default function Page() {
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

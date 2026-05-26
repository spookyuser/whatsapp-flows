---
name: whatsapp-flows-best-practices
description: Meta's official WhatsApp Flows best practices, mapped to whatsapp-flow-tsx primitives. Use when designing, structuring, reviewing, auditing, or critiquing a Flow's UX and content rather than its build mechanics — deciding how many screens / how to split tasks, whether a flow needs an endpoint (`<Exchange>`) or can stay data-channel-less, picking the right input component (date picker vs text, radio vs checkbox vs dropdown, how many options), writing CTAs / screen titles / helper text / error messages, structuring the initiation chat, login, opt-in/consent, and termination (summary screen, minimal completion payload, bookending), or handling latency, the 10s endpoint timeout, and flow_token expiration. Apply it when the user asks "is this flow any good / following best practices", wants a flow reviewed or improved, or is planning a flow before writing it. For the mechanics of writing/compiling/pushing the TSX (component props, routing, `flows push`), use the companion `whatsapp-flow-tsx` skill; for message templates, `whatsapp-template-tsx`.
---

# WhatsApp Flows best practices (design & review lens)

Meta's [official Flows best practices](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/bestpractices)
translated into concrete moves for the **`whatsapp-flow-tsx`** framework. This is the
*design and review* layer: what makes a flow good for users and cheap to run. For the
*mechanics* — component prop names, routing, images, `flows push` — use the
**`whatsapp-flow-tsx`** skill (and its `references/authoring.md`); for the encrypted
endpoint protocol, `references/endpoint.md`.

Use this when **planning a new flow**, when **reviewing/auditing** an existing one
("is this any good?"), or when deciding an architectural fork (endpoint or not? one
screen or three?). Most items map to a specific TSX lever; the [checklist](#review-checklist)
at the end is the fast pass.

## Structure: short, one task per screen

A flow is a task the user wants done, not a form to slog through. Target **≤ 5 minutes**.

| Guideline | In `whatsapp-flow-tsx` |
| --- | --- |
| **One task per screen.** Don't cram multiple jobs onto one `<Screen>`. | Split into multiple PascalCase screen exports linked by `<Next to="…">`. |
| **Don't overload a screen with components.** Messy, slow to load, and brittle (see caching). | Keep each `<Screen>`'s `<Form>` lean; move secondary steps to their own screen. |
| **Build for caching.** When the user advances, the screen's entered data is cached; if a screen is overloaded and they exit, *all of it* is lost — frustrating. | Smaller screens = less lost on exit. Carry values forward with `<Next data={…}>` + the destination `<Screen data={…}>` schema so progress survives navigation. |
| **Diverging / sub-flows** (e.g. "forgot password") should be **≤ 3 screens** and always return to the main task. | Branch with extra screen exports; route the last one's `<Next>` back to the main path's route. |

## The endpoint decision (do you even need one?)

**Default to a flow with no data endpoint.** Endpoint-less flows give a better
experience, are faster to build, and let dynamic data be injected at *send* time. Reach
for an endpoint **only when live data is required mid-flow** (e.g. ticket booking,
credential checks, slot availability, live pricing).

- Prefer client-side primitives: `<Next>` / `<UpdateData>` for navigation and on-device
  state, `<If>` / `<Switch>` for conditional UI — **no round-trip**.
- Use `<Exchange>` (and set `dataApiVersion` + `endpointUri` in `defineFlow`) **only for
  the specific screens that need live data**, and `<Next>` for the rest.
- **Keep the first screen (`Index`) data-channel-less** to optimize flow opening — don't
  make opening the flow wait on your server.

If you do add an endpoint, see [Technical](#technical-latency-timeout-flow_token) and the
endpoint-driven retry pattern in `whatsapp-flow-tsx`'s `references/authoring.md`
(the static routing graph must still be acyclic and reach a `<Complete>`).

## Technical: latency, timeout, flow_token

Endpoint requests **time out after 10 seconds** — past that the flow errors for the user.

- Reduce calls to third-party platforms; make slow ones **async**; **cache** unchanged
  data so you don't re-fetch.
- **`flow_token` expiration:** recommend **2–3 days** so users have time to act on the
  flow message after receiving it. If security forces a shorter window, either embed a
  re-auth step or set a friendly message for the [invalid-token error](https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/reference/error-codes#endpoint_error_codes)
  telling the user to request a new flow message. If you must time-box, start the clock at
  the **`INIT`** request (flow opened), not at send.
- The `flow_token` and `flow_action_payload` are set on the **send** side (the Graph API
  `/messages` call or a template `FLOW` button), **not** in the compiled flow JSON — that
  lives in your messaging/Graph-API layer, outside this framework.

## Forms & inputs: use the right component

> Match the input to the data. Wrong components cost taps and trust.

| Need | Use |
| --- | --- |
| A date (DOB, appointment) | `<DatePicker>` / `<CalendarPicker>` — never a free-text field |
| A long answer | `<TextArea>`, not `<TextInput>` |
| **One** choice | `<RadioButtonsGroup>` |
| **Multiple** choices | `<CheckboxGroup>` (or `<ChipsSelector>`) |
| Many options (**8+**) | `<Dropdown>` — below 8, prefer radios/chips so options are visible |
| Email / phone / number / secret | `<TextInput inputType="email|phone|number|password|passcode" />` |

More rules:

- **≤ 10 options per screen.** Beyond that, rethink the screen.
- **Default the top option.** Make the first `<Option>` the sensible default
  (`initValue` where the component supports it).
- **Logical order** (first name, then last name, …) and **labels with full clarity** on
  what's being asked.
- **Make non-critical fields optional** — only set `required` on what the task truly needs.
- **Helper text** for format expectations (phone, date, email): use the `helperText` prop
  on `TextInput` / `TextArea` / `DatePicker`.
- **Validation must be communicated.** Set `errorMessage` (on the text/selection inputs
  that support it) and `pattern` / `minChars` / `maxChars` so the rule is visible, e.g.
  "Password must be at least 8 characters".

## Content & copy

- **CTAs say what happens next.** The button label is the action being completed —
  "Confirm booking", not "Submit". Set it via the action's label/children or `Footer label`.
- **Sentence case** on screen titles, headings, and CTAs; **consistent** throughout.
- **Clear hierarchy:** heading → body → caption (`<TextHeading>` / `<TextBody>` /
  `<TextCaption>`). Don't repeat content ("Complete registration" + "Complete
  registration below").
- **Format for context:** currency symbols, phone numbers, dates. (Format the *string*
  you put into the text — there's no auto-formatting.)
- **Grammar & spelling:** proof every screen before `flows push` — published flows are live
  immediately, there's no draft gate.
- **Emojis:** only when appropriate, additive, and on-brand.

## Navigation & progress

- **Set time expectations** up front: "It should only take a few minutes."
- **Action-oriented, concise screen titles** so users know where they are ("Book
  appointment") — set `<Screen title="…">`.
- **Show progress** in the title where it helps: "Question 1 of 3".
- **End with a summary screen** (the terminal `success` screen) so users review before
  completing, especially for multi-step flows.

## Initiation: the chat → flow handoff

The user decides whether to open the flow from the **chat message + CTA**, before the
flow exists. (This lives in your template / message-send layer — `whatsapp-template-tsx`
for `FLOW`-button templates.)

- The exchange should feel **conversational** and give clear, task-focused context.
- The CTA is **short and concise** and names the task they'll complete.
- **No surprises:** the **first screen must mirror the CTA**. Any deviation reads as a
  bait-and-switch and users close the flow — keep `Index` aligned with what the chat
  promised.

## Login screens

- **Only when necessary** — a login screen can be off-putting; set expectations so it
  isn't a surprise.
- Users can **lose their sense of place** and think a login takes them outside WhatsApp.
  Reassure them they're still in the flow.
- **Show the benefit first.** Place the login **late**, just before completion, after the
  value is clear — not as the opening screen.

## Opt-in & consent

- Make it **clear what the user is consenting to** — use `<OptIn>` with an explicit label.
- Provide a **"Read more"** path to the relevant terms via `onClickAction={<OpenURL …/>}`
  on the `<OptIn>`, or an `<EmbeddedLink>`.

## Termination: summary, minimal payload, bookend

- **Set expectations on the last screen:** tell the user what happens when they finish,
  and confirm their actions.
- **Keep the completion payload minimal.** Only include data the *user* entered in
  `<Complete data={…}>`. **Never** send base64 images or bulky blobs in the payload.
- **Bookend the flow:** after submission, send a follow-up message with next steps and a
  contact path. (That message is a normal WhatsApp send / Graph-API action, not part of
  the flow JSON.)
- **Sensitive fields in the response summary (Flows ≥ 5.1):** on submit, the user sees a
  summary of their inputs. `inputType="password"` / `"passcode"` fields are **excluded
  automatically** — use them for secrets. To hide *other* fields (SSN, DOB), list their
  names in the `sensitive` array on the screen: `<Screen sensitive={["ssn", "dob"]}>`.

## Error handling

- Errors should say **what happened and how to fix it**; validation rules must be clear
  (see `errorMessage` / `helperText` above).
- **On an endpoint flow, if a screen becomes invalid** (e.g. the booking slot was taken),
  **take the user back to the previous screen — don't end the flow.** With this framework
  that's the **endpoint-driven retry** pattern: the endpoint re-navigates to the input
  screen (by compiled screen id, e.g. `START`) carrying the magic `error_message` field,
  which renders inline. Do **not** model retries as static self-loops — Meta rejects cyclic
  routing. Full pattern in `whatsapp-flow-tsx`'s `references/authoring.md`.

## Trust & support

- The **business logo** (profile photo) should be simple and identifiable so users trust
  the flow. (Set on the WhatsApp business profile, not in the flow.)
- Add a **"get in touch" CTA** inside the flow (`<EmbeddedLink>` / `<OpenURL>`) or in the
  follow-up message, for when users need help.

## Review checklist

Fast pass when auditing a flow:

- [ ] Completes in **≤ 5 min**; **one task per screen**; no overloaded screens.
- [ ] **No endpoint** unless live data is genuinely needed; if used, `Index` stays
      data-channel-less and only the screens that need it use `<Exchange>`.
- [ ] Endpoint work is async/cached and well under the **10s** timeout.
- [ ] Right input per field (date→`DatePicker`, long→`TextArea`, single→radio,
      multi→checkbox, 8+→dropdown); **≤ 10 options**, sensible default first.
- [ ] Non-critical fields **optional**; `helperText` + `errorMessage` set where they help.
- [ ] CTAs name the action; **sentence case**; clear heading/body/caption hierarchy; no
      repeated copy; correct currency/phone/date formatting; proofread.
- [ ] Titles are action-oriented; progress shown if multi-step; **summary screen** at the
      end.
- [ ] First screen **mirrors the initiating CTA** (no surprises).
- [ ] Login (if any) is late, justified, and reassures the user they're still in WhatsApp.
- [ ] Opt-in is explicit with a **Read more** link.
- [ ] Completion payload is **minimal**, user-entered only, **no base64 images**; secrets
      use `password`/`passcode`; a **bookend** follow-up message is planned.
- [ ] Invalid endpoint screens **return to the previous screen** (error-message retry), not
      a dead end; routing graph is acyclic and reaches a `<Complete>`.
- [ ] `flow_token` expiry is **2–3 days** (or has a re-auth / friendly-error fallback).

## Source

Meta's living document — verify against it before shipping, as components and version
behavior change:
<https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/bestpractices>

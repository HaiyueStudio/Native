# NativeScript portable UI (M24 development preview)

Use the explicit `@haiyue/native/ui` entry with `@haiyue/ui/core` and `@haiyue/ui/portable`. It does not import Engine, register WebComponents or create a WebView. System-only Native consumers do not need UI. Do not import the Native root for this purpose.

This API is **not published**. G06 tests an audited G05 UI tarball repacked as private `@haiyue/ui@0.2.0-m24.0`, and a private Native `0.1.4-m24.0` tarball. Registry UI 0.2.0 lacks these subpaths. See the [development consumer](../../examples/ui-validation/mobile/README.md) and [ADR](../../docs/for-ai/adr/2026-10-16-g06-nativescript-adapter.md). G10 assigns public versions and compatibility ranges.

```ts
import { GridLayout, Page } from '@nativescript/core';
import { hyNode } from '@haiyue/ui/core';
import { HYPage } from '@haiyue/ui/portable';
import { HYNativeScriptRenderer } from '@haiyue/native/ui';

const nativePage = new Page();
const host = new GridLayout();
nativePage.content = host;
let page: HYPage;
const renderer = new HYNativeScriptRenderer(host, { onBack: () => page.back() });
page = new HYPage(renderer, {
  onEvent(event) {
    // Dispatch to application actions; render accepted values from application state.
  },
});
page.mount(hyNode('Button', 'save', { text: 'Save' }));
// On session destruction (not a temporary background transition):
// page.dispose();
```

Call all page/renderer methods on NativeScript's main UI thread. Off-thread calls fail synchronously; dispatch worker results through the host before updating state. NativeScript caches public properties before a native view is ready; native text observers and clipping are attached only on `loaded`, detached on `unloaded`, and released on `dispose`.

Use stable keys. Transactions coalesce application changes through HYPage; only changed nodes receive updates. Unrelated text updates preserve input drafts and PlatformView instances. `diagnostics` exposes commits, node operations, owned listeners, scheduled layout timer and active PlatformView resources. These counters supplement native memory measurements; they are not proof that the OS heap is empty.

## Host responsibilities

- Use a NativeScript Page/Frame as the system safe-area owner. The default renderer root stays inside that area. Choose `safeArea: 'host'` only for a custom host that already supplies insets. Do not add safe-area padding twice.
- Set Android activity `windowSoftInputMode="adjustResize"`. Android handles keyboard resizing; iOS adds only the keyboard overlap with the safe-area root. Floating iPad keyboards retain native caret scrolling and require device verification.
- iOS text inputs include a native button above the keyboard to finish editing. Supply `keyboardDismissLabel` from the application's localized strings (default `Done`); this ends editing through the same blur/commit path and works for multiline inputs too.
- Dialog uses a centered, scrollable theme card (460 DIP maximum width by default) over a dimmed native modal window. Width/height constraints apply to the card; the host keeps safe-area insets and bounds it on rotation. iOS uses OverFullScreen so the presenting page remains visible.
- Select menus inherit the current semantic theme. Set `selectionCancelLabel` from localized strings (default `Cancel`); cancelling retains the controlled value and is independent of `keyboardDismissLabel`. Buttons and selectors use theme borders/radii and a 44 DIP minimum touch target without application CSS margins.
- `onBack` is the single navigation owner. Open native dialogs consume Android back; a dismissible dialog emits `cancel`, and the application sets `open=false`. Programmatic close does not emit cancel. Native system dialogs contain their own focus scope; HYPage restores the opener afterward.
- Application suspend/resume pauses resource visibility without destroying state. If application updates must also be suspended, call `HYPage.suspend/resume` from the shell. Dispose the page when the session is destroyed.
- `setEnvironment({theme, fontScale})` updates semantic tokens. Omit fontScale for OS font sizing. Explicit scale is a preview/test override; device font-scale behavior is still part of physical acceptance. High contrast and RTL are not advertised capabilities in this preview.
- `resolveResource(resource, {key,kind})` returns a bundled path or NativeScript ImageSource synchronously. Resolve async resources before rendering. iOS system symbols use public UIKit APIs; Android uses the declared image fallback. No shared code writes `nativeView.systemIcon`.
- `platformViews[slot](host, context)` returns the frozen HYPlatformView port. Add native children during `mount`, remove/release them during `dispose`. `layout` receives logical window coordinates/dimensions and screen scale. `resourceId` is business data, never a GPU object. Factory slot is immutable for a key; change key to change factory. Preview rendering/real code editor integration belongs to the product.

## Component mapping and limits

| Semantic component | NativeScript / native implementation |
| --- | --- |
| Row, Column | FlexboxLayout, grow/align/gap/padding/size bounds |
| Grid | GridLayout; fixed, auto and weighted tracks; gaps are explicit tracks |
| Overlay | GridLayout sharing a cell, child alignment and clipping |
| Scroll | ScrollView with a single owned content layout |
| Text, Image, Icon | Label, Image; resource resolver and iOS symbol fallback |
| Button, Toggle | System Button and Switch, shared controllers |
| Select | Button plus cancelable native modal of enabled options |
| Tabs | System buttons plus retained, selected content; named option slots |
| TextInput, TextArea | TextField/TextView; UIKit after-edit notifications or Android text/span observers |
| Slider | System slider mapped to discrete shared steps; touch end or accessibility adjustment commits |
| Dialog | Native modal presentation; default content and footer slot |
| FormGroup | Label/content/error; native accessibility label/hint and error announcement |
| PlatformView | Owned layout with injected lifecycle port |

Native Button supports its text prop, not arbitrary nested button content; put icons beside it in a Row or inject a product PlatformView. Unknown resources, missing factories, invalid slots and unsupported features fail with node/operation/revision diagnostics instead of rendering an empty fallback. VirtualList/Tree are G09.

The backend advertises implemented text composition/selection/secure input, accessibility and reduced-motion behavior (it does not animate controls). Capability availability is not a claim that physical IME or VoiceOver/TalkBack acceptance passed. Current evidence and remaining checks live in [G06 review](../../review/m24-ui/g06/README.md).

### Native presentation controls

`@haiyue/native/ui` explicitly exports `HYNativeButton`, `HYNativeButtonProps`,
`hyPickNativeOption`, and `HYNativeSelectionOptions` for host-owned native toolbars.
They use the same optional `Button.icon`, `variant`, `size`, theme state colors and
typographic ramp as the portable renderer; the real OS Button retains its keyboard
and accessibility behavior. Icon buttons require an accessible label. `busy` uses
a native indicator, stopped on unload or renderer suspension.

`hyPickNativeOption(anchor, options)` returns `{result, cancel}`. Owners must call
`cancel()` when disposed. Selection settles after native dismissal, and supports
`auto` and `popover` (anchored below the control on phone and tablet), and explicit
`sheet`. Anchored menus scroll when space below is limited and use space above
only when fewer than two rows fit below. Tapping outside cancels. Existing dialogs keep their centered layout.
`Tabs.variant` supports `underline` and `segmented`, including disabled options.
These are additive APIs; existing protocol nodes and themes remain valid.

### Host-owned overlays, fields and responsive layouts

`@haiyue/native/ui` explicitly exports `hyShowNativeOverlay`,
`HYNativeOverlayOptions` and `HYNativeOverlayHandle`. Dialog, sheet and drawer
presentations share the modal surface used by portable Dialog and Select.
The title and optional footer remain pinned; the body scrolls independently.
Use `scrollable:false` for a body that owns its own scrolling (for example an
editor or material browser). Handles expose `close()`, `closed` and `setTitle()`;
`closed` settles after native dismissal. Backdrop cancellation respects
`dismissible`; owner navigation closes the overlay. Keyboard observers and pending
layout work are released on dismissal. An optional returnFocus restores the opener.

`HYNativeFormField` / `HYNativeFormFieldOptions` associate a host-owned control with
its label, description and error. Inline layout supports toggles. Metadata changes
never assign control text or checked values. Portable `FormGroup.description`
provides the same visible help and accessible hints in Web and Native renderers.

`HYNativeCardGrid` and `HYNativeWorkspace` reuse the public, DOM-free
`hyResponsiveGrid` / `hyResponsiveWorkspace` layout decisions from
`@haiyue/ui/portable`. They reflow existing view instances on window changes;
workspace panes and text composition survive rotation and compact mode. Layout
requests coalesce, and keyboard observers and timers stop when views unload.

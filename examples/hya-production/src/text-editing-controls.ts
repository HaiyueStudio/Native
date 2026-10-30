import {GuiInput, type GuiSystem, type GuiTextInputHost} from '@haiyue/engine/gui';

type FocusOwner = Pick<GuiSystem, 'focus'>;
/** Keep dismissal in the existing GUI focus owner so IME finish/cancel runs once. */
export function createTextEditingControls(native: GuiTextInputHost, gui: () => FocusOwner | null, requestFrame: () => void) {
  const dismiss = (cancel = false): void => {
    const owner = gui();
    if (!owner) return;
    const field = owner.focus.focused;
    if (cancel && field instanceof GuiInput) field.cancelComposition();
    // beforeBlur commits native preedit for Done; Cancel has already discarded it.
    owner.focus.blur();
    requestFrame();
  };
  const host: GuiTextInputHost = {open(request) {
    return native.open({...request, onCommand(command) {
      const focused = gui()?.focus.focused;
      request.onCommand(command);
      // onSubmit may synchronously move focus to another field; preserve that move.
      if (command === 'submit' && gui()?.focus.focused === focused) dismiss();
    }});
  }};
  return {host, dismiss};
}

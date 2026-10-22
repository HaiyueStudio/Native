/** ObjC blocks may outlive their observer/action registration. Keep the block
 * in its own lexical scope and sever its application callback on disposal. */
export function createNativeCallback<T extends unknown[]>(callback: (...args: T) => void): {
  invoke: (...args: T) => void;
  dispose: () => void;
} {
  let handler: ((...args: T) => void) | undefined = callback;
  // Do not retain the original argument in the closure's shared context.
  return {
    invoke: (...args) => handler?.(...args),
    dispose: () => { handler = undefined; },
  };
}

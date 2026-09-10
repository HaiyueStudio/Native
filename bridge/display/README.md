# iOS screen orientation

`NativeOrientationController` installs an application delegate before `Application.run`.
Three policies are supported:

| Policy | Allowed orientations |
| --- | --- |
| `portrait` | Upright portrait |
| `landscape` | Landscape left and right |
| `any` | Portrait and both landscape directions |

```ts
const orientation = new NativeOrientationController('any', 'portrait');
Application.run({ moduleName: 'main-page' });
// Switch after entering a landscape game:
orientation.setPolicy('landscape');
```

The first argument declares the App's packaged support; the second is the initial
runtime restriction. Runtime changes must be subsets of packaged support. A
landscape-only App cannot request portrait without rebuilding. Upside-down
portrait is intentionally excluded from these three policies.

Spider Solitaire uses `examples/spider-solitaire/orientation.json` as its shared
build/runtime configuration. Its prepare/build/run wrapper generates both iPhone
and iPad Info.plist arrays from `supported`, and the app installs `initial` before
launch. Other host apps must likewise synchronize their plist arrays with this
configuration. Changing only the delegate cannot expand Info.plist support.

The existing app delegate is subclassed so its other handlers remain available.
The controller should live for the application lifetime. On iOS 16+, policy
changes invalidate the root controller's supported orientations and request a
window-scene geometry update. iOS 15 uses the public rotation reevaluation API.
Application resume reapplies the policy. No private UIDevice orientation mutation
is used. Full-screen hosts are required; iPad multi-window behavior is not covered.

Apple API references:
- [Application orientation mask](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/application(_:supportedinterfaceorientationsfor:))
- [Window scene geometry request](https://developer.apple.com/documentation/uikit/uiwindowscene/requestgeometryupdate(_:errorhandler:))

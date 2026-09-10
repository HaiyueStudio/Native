# Native save adapters

NativeSettingsStorage supplies scoped NativeScript application settings to the
public Engine LocalStorageSaveBackend. Writes call settings.flush(); backend and
slot policy stay in Engine/Games.

installNativeSaveRuntime accepts a structuredClone implementation supplied by the
host application. Older NativeScript runtimes need this operation for Engine
save envelope cloning. Spider pins core-js-pure 3.50.0; the bridge installs it only
when missing. This is a runtime capability adapter, not a browser DOM shim.

# Calendar Puzzle native demand rendering

The iOS and Android app now uses an opt-in host-owned demand loop. It calls the public Engine `run()` / `stop()` methods; other Native games and the web host retain their existing scheduling policy. The framebuffer remains displayed while idle. No low-frequency polling render timer is added.

## Wake / sleep policy

- First presentation, native layout changes and foreground resume request frames.
- Pointer down/move/up/cancel wake the host before game input is handled. This includes GUI presses and synthetic diagnostic input.
- Async solver success/failure/status updates explicitly invalidate the view. Waiting for a worker does not require continuous rendering.
- Rotate/flip/shuffle and the 4-second victory celebration keep normal animation cadence until completion.
- Selection pulses for 900 ms, hint markers pulse for 1,200 ms, then remain steadily highlighted. A held stationary finger does not keep frames running after the pulse finishes.
- Pending audio-unlock retries keep their existing bounded 250 ms window; native audio playback itself does not require visual frames.
- Each invalidation is coalesced into a short two-frame tail because Engine GUI callbacks run during the GUI pass, after the 3D board pass. Animations also retain settling frames for final static poses/colors.
- Restart is deferred to a microtask. A synchronous stop/start inside an after-update listener would otherwise let Engine FrameLoop schedule two RAF chains. There is never more than one owned chain.
- Suspension/error/disposal disables wakeups; resume draws fresh frames. Pending asynchronous results cannot restart a disposed host.

Implementation: `Native/bridge/lifecycle/demand-frames.ts`, opt-in `needsAnimationFrame` / `requestFrame()` in `host.ts`; CalendarPuzzleGame exposes animation activity and accepts `platform.requestRender`.

## Verification

Unit tests reproduce the Engine loop's schedule-at-end behavior, 3,600 idle ticks with no queued callbacks, burst coalescing, late GUI invalidation, animation completion, async wake, suspension and disposal. The Native gameplay smoke harness pumps only its initial frame-scripted section; subsequent hint/interaction/idle checks rely on the actual demand loop. Idle samples compare real presented-frame counts and the pending native callback count.

The app still uses the same rendering resolution, 4× MSAA and animation fidelity. This change reduces rendering work during thinking time; display hardware, audio, worker solving and operating-system work still consume power. Do not claim a specific temperature or battery percentage reduction without controlled power measurements.

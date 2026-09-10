# Pause: return to home — 2026-09-10

The Engine GUI pause panel contains two generated-skin buttons with live labels:
Continue and Return Home. Labels are localized in Chinese, English and Japanese.
The panel has more vertical space to keep both touch targets separated.

Return Home is accepted only while paused. It saves career statistics, ends the
sortie, clears input/capture, projectiles, enemies, pickups, lasers, transient
effects and camera shake, and shows the normal level carousel at the current
mission. It does not create another World, GUI system or input listener. A fresh
launch uses the existing startSortie reset path.

Games/native typechecks and 24 focused tests passed. Browser WebGPU checks
exercised two return/relaunch cycles in each language, verifying empty battle
state, stopped input and fresh score/bomb inventory. Wide/narrow input, bomb and
pause/resume checks also passed. The Chinese pause screenshot was reviewed;
no golden baselines were changed. The signed native package installed and launched successfully. The device journal recorded 4,680 presented frames without errors. Native button interaction remains browser-verified through the shared implementation.

The build/source hashes and browser captures accompany this document.

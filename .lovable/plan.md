# Drag-to-place the Front Door marker

Your boss's instinct is right: dragging a labeled chip onto the spot is more
discoverable than "tap a button, then tap the plan." Best answer is to support
both — add drag, keep tap-to-arm as the fallback so nothing you already do breaks.

## What changes in the rooms overlay

1. **Drag the FD button onto the plan.** Press and drag the blue FD button; a
   floating FD chip follows your finger. Release over the plan and the marker
   drops at that point. Release off the plan and nothing happens.
2. **Tap FD still works.** A quick tap (no drag) arms the current
   "tap the plan where the FRONT DOOR is" mode exactly as it does today.
3. **Move a placed FD by dragging it.** Today tapping the placed FD only offers
   "remove." After this, dragging it repositions it; a plain tap still asks to
   remove it.

## Not included

- Room name badges stay tap-to-edit (no dragging) unless you want that too.
- No change to how the front door feeds direction math, the compass, CSV, or the PDF.

## Technical notes

All in `public/survey.html`:

- Add pointer handlers on `#rvFdBtn`: `pointerdown` starts a candidate drag with
  pointer capture; movement past a small threshold (~6px) switches to drag mode
  and shows a follower chip; `pointerup` either converts the drop point to
  normalized plan coords via the existing `_rvState` scale/translate math (same
  formula as `_rvAddRoomAt`) and sets `_setupFrontDoor`, or — if it never moved —
  calls the existing `_rvToggleFdMode()`.
- Add the same drag handling to the `.rv-fd` element created in
  `_rvRenderBadges()`, guarding the existing click-to-remove behavior with a
  "did it move" flag.
- The overlay's stage pan/pinch handler already ignores events inside
  `.rv-fd` and `button`, so drags won't pan the plan.
- Update the `#rvTitle` hint text to mention dragging.

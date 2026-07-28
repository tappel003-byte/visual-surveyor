I would not patch this with another picker or manual workaround. The problem is the app currently treats each room label as a point, then assigns the pin to the nearest label. That is why a pin can be inside a hallway or living room and still snap to a nearby word fragment like "Area" or "Room".

Plan:

1. Keep the existing room labeling workflow
   - Do not rebuild the canvas, pins, photos, quick capture, import/export, or room picker.
   - Keep the manual room list and OCR room detection as the source of room names.

2. Change pin-to-room assignment from “nearest label dot” to “estimated room area”
   - Use the uploaded floor plan image dimensions and the detected/manual room label positions.
   - Build invisible room regions from those label positions.
   - When a pin is dropped, assign it to the region the pin is actually inside, not just the closest label text.

3. Filter bad OCR fragments before they can become rooms
   - Reject generic orphan labels such as “Room”, “Area”, “Space”, and similar fragments when they are not part of a real room name.
   - Preserve valid names like “Living Room”, “Dining Area”, “Primary Bedroom”, and “Hallway”.

4. Add a fallback for ambiguous areas
   - If the app cannot confidently determine the region, it should leave the location blank or use the manually selected location, instead of confidently assigning the wrong room.
   - The room picker remains the fallback, but the auto-fill should stop poisoning pins with bad guesses.

5. Make export use the improved room result
   - The same improved room assignment should feed the review sheet, CSV, and 11x17 PDF export so the displayed location and exported location match.

Technical detail:

- The current `pinRoom(project, pin, labels)` function finds the closest room label by Euclidean distance.
- I would replace that with a bounded-region lookup based on the detected room-label points, with a maximum confidence/distance guard.
- I would also harden OCR cleanup so single generic fragments are not saved as standalone room labels.

Expected result:

- Pin 1 should not become “Area” just because the word AREA is near it.
- Pin 6 should not become “Room” just because OCR split “Living Room”.
- Pins should map to real room names more consistently, and ambiguous pins should be safer to manually correct instead of wrong by default.
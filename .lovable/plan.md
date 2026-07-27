Simple strip + rename pass on the home screen in `public/survey.html`. No functionality changes elsewhere — offline/PWA behavior stays exactly as-is.

## Changes

1. **Remove External Camera card** entirely from the home screen. Everything the External flow does (map-only export) stays in the codebase but becomes unreachable from the UI.
2. **Rename Internal Camera card** to **"PGG Photo Documentation"**.
3. **Remove the subtitle** "Field reporter for foundation inspections" under the header.
4. **Remove the "Update app" link** on the home screen. Background auto-update via the service worker keeps working — users just won't see a manual trigger.
5. **Rename the page/app title** from "Distress Survey" to **"PGG Photo Documentation"** on the home screen header.

## Not touching

- Browser tab title / PWA manifest name / route `<head>` metadata (still says "Distress Survey – Field Reporter"). Say the word and I'll rename those too in a follow-up.
- All setup, work, pin, and export screens.
- Service worker, offline caching, ZIP export.

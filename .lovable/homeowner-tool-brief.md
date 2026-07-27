# TLS Foundations — Homeowner Photo Submission Tool

**Paste this entire document into a new Lovable project as the opening message. Then never mention it in the field-reporter project again.**

---

## What this is

A dead-simple, mobile-first web tool that lives on (or links from) **tlsfoundations.com**. A worried homeowner pulls it up on their phone, takes a few photos of cracks or damage, says which room each one is in, adds optional notes, fills in their contact info, and submits. The submission lands with TLS Foundations as an organized lead.

**Core purpose:** lead capture *and* stress relief. The "doing something" is the product. A homeowner panicking at 2 a.m. needs to feel they've handed the problem to a professional — that act of submission is the relief, even before anyone calls them back.

## Who it's for

Homeowners with zero technical skill, on whatever phone they own (iPhone or Android), often stressed, often at odd hours. **No app install. No account. No sign-in.** It must work from a tapped link in under 10 seconds.

## The entire user flow

1. **Landing screen** — TLS Foundations branding, one short reassuring line ("Worried about a crack? Send us photos in 2 minutes — we'll take a look."), one big button: **Start**.
2. **Photo step** (repeatable)
   - Big "Take a photo" button (opens phone camera) and a smaller "Choose from gallery" option.
   - After capture: thumbnail preview.
   - **Where is this?** — chip selector: Kitchen, Living Room, Bedroom, Bathroom, Hallway, Garage, Basement, Exterior, Other (free text if Other).
   - **What worries you about this?** — single optional text field, one line, placeholder like "crack getting bigger" or "door won't close".
   - **Add another photo** button or **Done** button.
3. **Your info** — name, phone, email, property address. That's it.
4. **Review & send** — thumbnail strip of all photos with their labels, one **Send to TLS Foundations** button.
5. **Confirmation** — "Got it. Brad will be in touch within [X] hours." Plus a copy of what they sent emailed to them.

That's the whole app. **No floor plans. No pins. No drawing. No symbols. No severity ratings.** If you find yourself adding a feature, stop and ask whether a stressed homeowner at 2 a.m. needs it. The answer is almost always no.

## Where the submission goes

Default: each submission emails Brad at TLS Foundations with photos attached (or linked) plus all the metadata, AND stores it in Lovable Cloud so there's a record.

Stretch (only if Brad asks for it later): a simple `/admin` dashboard he can log into that lists incoming submissions, lets him mark them contacted, and search by address. Do not build this on day one.

## Visual & tone

- **Calming, trustworthy, residential** — not industrial, not "construction site." Think the feeling of calling a doctor's office, not a contractor.
- Warm neutrals (soft off-white background, deep navy or warm charcoal text, one trustworthy accent — muted teal or warm orange).
- Large tap targets, generous spacing, big readable type. Assume one-handed phone use, possibly through tears.
- Reassuring microcopy throughout. Never make the user feel dumb. Never use the words "error," "invalid," or "failed" — soften to "let's try that again."
- Skip stock photos of cracks. Brand presence is TLS Foundations logo + a calm color palette.

## Technical notes

- Mobile-first. Desktop is a nice-to-have, not a requirement.
- Camera access via standard `<input type="file" accept="image/*" capture="environment">` — works on both iOS Safari and Android Chrome without permissions theater.
- Use **Lovable Cloud** for storage (photos in a bucket) and submission records (one row per submission, plus a child table or JSON column for photo entries with their room labels and notes).
- Use **Lovable Email** to send the submission to Brad's inbox and a confirmation copy to the homeowner.
- No authentication on the submission flow. RLS allows anonymous inserts to the submissions table and anonymous uploads to a write-only storage bucket. Admin dashboard (if built) is the only authenticated surface.
- Should be embeddable in an `<iframe>` from tlsfoundations.com OR linkable as a standalone page — design so both work.

## What "done" looks like

A homeowner can:
- Tap a link from tlsfoundations.com on their phone
- Take 3 photos, label each room, add a worry note
- Type their name/phone/email/address
- Hit send
- See a confirmation screen

…in under 3 minutes, with zero friction, zero questions, zero confusion. And Brad gets an organized email with everything attached.

## What this is NOT

- Not a pro inspection tool. (Brad has one of those already; don't try to be it.)
- Not a quote calculator.
- Not a chatbot or "AI assessment."
- Not a scheduling tool. (Just capture the lead; Brad calls back.)
- Not multi-step "wizards" with progress bars. The flow is short enough not to need one.

---

**Start by building the photo-capture flow first.** Storage, email, and the admin view can come after the core flow feels right.

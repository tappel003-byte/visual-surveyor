# Job number field: remove helper text and character limits

## What you'll see

The Job number box on the New Survey (and Edit Setup) screen becomes clean: the only words are the label **Job Number**. No grey hint inside the box, and you can type as many characters as you like — digits, letters, dashes, whatever a job reference needs. The box itself stays the same width, so it simply fills up.

## Changes

In the setup screen markup:

- **Remove the placeholder text** `4–6 digit job number (optional)` entirely, so the box is empty until you type.
- **Remove `maxlength="12"`** — no cap on length. The only practical limit is how much fits in the box on screen.
- **Remove `inputmode="numeric"`** — the normal full keyboard comes up instead of a digits-only one, so letters and symbols are allowed.
- **Label set to `Job Number`** exactly, as the only visible text.

```text
Before:                          After:
Job number                       Job Number
[ 4-6 digit job number (opt.]   [ ______________________ ]

After:
Job Number
[ ______________________ ]       <- type anything, any length
```

## Not changing

- Where the field sits (above Address) and its width.
- Saving and reloading the job number with the project.
- The `#<job number>` line shown under each job in the jobs list.
- Any other setup field, the address buttons, floor plan, front door, pin numbering, or export.

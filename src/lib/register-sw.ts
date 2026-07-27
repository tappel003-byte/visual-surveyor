// NOTE: Service worker registration is owned by public/survey.html (the
// visible UI, loaded directly and inside the React shell's iframe). This
// module is intentionally a no-op export kept only so any lingering imports
// resolve. Do NOT register a second worker from the React shell.

export function registerAppShellSW(): void {
  // no-op — see note above
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  clearOfficeSession,
  hasValidOfficeSession,
  issueOfficeSession,
  officeAuthConfigured,
  officeAuthHostKind,
  verifyOfficePassword,
} from "@/server/office-session";

export const officeAuthStatus = createServerFn({ method: "GET" }).handler(async () => {
  return {
    configured: officeAuthConfigured(),
    authenticated: hasValidOfficeSession(),
    hostKind: officeAuthHostKind(),
  };
});

export const officeLogin = createServerFn({ method: "POST" })
  .validator(z.object({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => {
    if (!officeAuthConfigured()) {
      const host = officeAuthHostKind();
      if (host === "lovable") {
        throw new Error(
          "Office login is not configured on this host yet. Set OFFICE_PASSWORD (same company password as www) in Lovable project secrets.",
        );
      }
      throw new Error(
        "Office login is not configured. Set NLF_OFFICE_PASSWORD and NLF_SESSION_SECRET in Netlify environment variables.",
      );
    }
    if (!verifyOfficePassword(data.password)) {
      throw new Error("Wrong password.");
    }
    issueOfficeSession();
    return { ok: true as const };
  });

export const officeLogout = createServerFn({ method: "POST" }).handler(async () => {
  clearOfficeSession();
  return { ok: true as const };
});

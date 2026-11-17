export interface DeveloperInvitationEmailInput {
  recipientEmail: string;
  organizationName: string;
  role: string;
  rawToken: string;
  expiresAt: Date;
  kind: "membership" | "owner_transfer";
}

export interface DeveloperInvitationEmailMessage {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDeveloperInvitationEmail(
  input: DeveloperInvitationEmailInput,
  options: { from: string; linkOrigin: string }
): DeveloperInvitationEmailMessage {
  if (!/^[a-f0-9]{64}$/i.test(input.rawToken)) {
    throw new TypeError("Developer invitation token is invalid.");
  }
  const origin = new URL(options.linkOrigin);
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) {
    throw new TypeError("Developer invitation link origin must be a clean HTTPS origin.");
  }

  // The token is placed in the fragment so it is not sent in the HTTP request,
  // Referer header, or ordinary web-server access logs. The portal must read
  // the fragment and POST the token in the request body to /invitations/accept.
  const link = new URL("/invitations/accept", origin);
  link.hash = new URLSearchParams({ token: input.rawToken.toLowerCase() }).toString();

  const ownerTransfer = input.kind === "owner_transfer";
  const action = ownerTransfer ? "Confirm ownership transfer" : "Accept invitation";
  const subject = ownerTransfer
    ? "BrightGlobe developer ownership transfer"
    : "You're invited to a BrightGlobe developer organization";
  const safeOrganization = escapeHtml(input.organizationName);
  const safeRole = escapeHtml(input.role.replace(/_/g, " "));
  const safeLink = escapeHtml(link.toString());
  const expiry = input.expiresAt.toISOString();

  return {
    from: options.from,
    to: [input.recipientEmail],
    subject,
    text: [
      ownerTransfer ? "You have been invited to become the owner of" : "You have been invited to join",
      input.organizationName + ".",
      ownerTransfer ? "Accepting transfers ownership from the current owner." : "Your organization role will be " + input.role + ".",
      "Open this link to continue: " + link.toString(),
      "This invitation expires at " + expiry + ".",
      "If you were not expecting this invitation, you can ignore this email.",
      "BrightGlobe"
    ].join("\n\n"),
    html: `<!doctype html><html><body style="margin:0;padding:32px;background:#071225;color:#eaf2ff;font-family:Arial,sans-serif"><main style="max-width:560px;margin:0 auto;padding:32px;background:#101e35;border:1px solid #263a5b;border-radius:16px"><p style="color:#9eb4d7;font-size:12px;letter-spacing:2px">BRIGHTGLOBE</p><h1 style="font-size:24px">${action}</h1><p style="line-height:1.6">${ownerTransfer ? "You have been invited to become the owner of" : "You have been invited to join"} <strong>${safeOrganization}</strong>.</p><p>Your role: <strong>${safeRole}</strong></p><p style="margin:28px 0"><a href="${safeLink}" style="display:inline-block;padding:14px 22px;border-radius:24px;background:#7957bd;color:#fff;text-decoration:none;font-weight:bold">${action}</a></p><p style="color:#9eb0cc;font-size:12px">This invitation expires at ${expiry}. If you were not expecting this invitation, you can ignore this email.</p><p style="color:#9eb0cc;font-size:12px;word-break:break-all">If the button does not work, open: ${safeLink}</p></main></body></html>`
  };
}

export function createResendDeveloperInvitationDelivery(options: {
  apiKey: string;
  from: string;
  linkOrigin: string;
  fetcher?: typeof fetch;
}) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async send(input: DeveloperInvitationEmailInput): Promise<void> {
      const message = buildDeveloperInvitationEmail(input, {
        from: options.from,
        linkOrigin: options.linkOrigin
      });
      const response = await fetcher("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + options.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) {
        // Do not log recipient, token, message body, or provider credentials.
        throw new Error("Developer invitation email provider returned HTTP " + response.status + ".");
      }
    }
  };
}

import type { AppEnvironment } from "../config/env.js";

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function createAuthEmail(
  kind: "verify" | "reset",
  recipientName: string,
  url: string
): TransactionalEmail {
  const safeName = escapeHtml(recipientName || "there");
  const safeUrl = escapeHtml(url);
  const isVerify = kind === "verify";
  const action = isVerify ? "Verify email address" : "Reset password";
  const subject = isVerify ? "Verify your BrightGlobe email" : "Reset your BrightGlobe password";
  const intro = isVerify
    ? "Confirm your email address to activate your BrightGlobe account."
    : "We received a request to reset your BrightGlobe password.";
  const expiry = isVerify ? "This link expires in 60 minutes." : "This link expires in 60 minutes.";
  return {
    to: "",
    subject,
    text: `Hi ${recipientName || "there"},\n\n${intro}\n\n${url}\n\n${expiry}\nIf you did not request this, you can ignore this email.\n\nBrightGlobe`,
    html: `<!doctype html><html><body style="margin:0;padding:32px;background:#071225;color:#eaf2ff;font-family:Arial,sans-serif"><div style="max-width:520px;margin:0 auto;padding:32px;background:#101e35;border:1px solid #263a5b;border-radius:16px"><p style="color:#9eb4d7;font-size:12px;letter-spacing:2px">BRIGHTGLOBE</p><h1 style="font-size:24px">${action}</h1><p>Hi ${safeName},</p><p style="color:#c3d0e5;line-height:1.6">${intro}</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:24px;background:#7957bd;color:#fff;text-decoration:none;font-weight:bold">${action}</a></p><p style="color:#9eb0cc;font-size:12px">${expiry} If you did not request this, you can ignore this email.</p><p style="color:#9eb0cc;font-size:12px">If the button does not work, copy this link into your browser:<br/><a href="${safeUrl}" style="color:#b7a0ed;word-break:break-all">${safeUrl}</a></p></div></body></html>`
  };
}

export async function sendAuthEmail(
  env: AppEnvironment,
  message: Omit<TransactionalEmail, "to"> & { to: string }
): Promise<void> {
  if (!env.EMAIL_ENABLED || !env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("BrightGlobe transactional email is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    // Do not log the recipient, message body, verification URL, or provider token.
    throw new Error(`Transactional email provider returned HTTP ${response.status}.`);
  }
}

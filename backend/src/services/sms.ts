import { env } from "../config/env.js";

export function dispatchPhoneOtp(phoneNumber: string, code: string): void {
  if (env.NODE_ENV !== "production") {
    console.info("[BrightGlobe development OTP]", { phoneNumber, code });
    return;
  }

  const endpoint = env.SMS_GATEWAY_URL;
  const token = env.SMS_GATEWAY_TOKEN;
  if (!endpoint || !token) {
    console.error("[BrightGlobe SMS] Production gateway is not configured.");
    return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      to: phoneNumber,
      template: "brightglobe-auth-otp",
      variables: { code, expiresInMinutes: 5 }
    }),
    signal: AbortSignal.timeout(8000)
  }).then((response) => {
    if (!response.ok) throw new Error("SMS gateway responded with HTTP " + response.status);
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown SMS gateway error";
    console.error("[BrightGlobe SMS] Delivery failed:", message);
  });
}

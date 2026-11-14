import type { AppEnvironment } from "../config/env.js";

export async function dispatchPhoneOtp(env: AppEnvironment, phoneNumber: string, code: string): Promise<void> {
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

  try {
    const response = await fetch(endpoint, {
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
    });
    if (!response.ok) throw new Error("SMS gateway responded with HTTP " + response.status);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[BrightGlobe SMS] Delivery failed:", message);
  }
}

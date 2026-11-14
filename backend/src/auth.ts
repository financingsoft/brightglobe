import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import type { AppEnvironment } from "./config/env.js";
import { buildTrustedOrigins } from "./config/origins.js";
import type { Database } from "./db/client.js";
import { isE164PhoneNumber, phoneToSyntheticEmail } from "./domain/phone.js";
import { sendAuthEmail, createAuthEmail } from "./services/email.js";
import { dispatchPhoneOtp } from "./services/sms.js";

export type BackgroundTaskScheduler = (promise: Promise<unknown>) => void;

export function createAuth(db: Database, env: AppEnvironment, scheduleBackgroundTask?: BackgroundTaskScheduler) {
  const deliverEmail = (to: string, kind: "verify" | "reset", name: string, url: string) => {
    const content = createAuthEmail(kind, name, url);
    const delivery = sendAuthEmail(env, { ...content, to });
    if (scheduleBackgroundTask) {
      scheduleBackgroundTask(delivery);
      return Promise.resolve();
    }
    return delivery;
  };

  const phoneAuthPlugin = env.SMS_ENABLED
    ? [phoneNumber({
        otpLength: 6,
        expiresIn: 60 * 5,
        allowedAttempts: 3,
        requireVerification: true,
        phoneNumberValidator: isE164PhoneNumber,
        sendOTP: ({ phoneNumber: destination, code }) => {
          const delivery = dispatchPhoneOtp(env, destination, code);
          if (scheduleBackgroundTask) {
            scheduleBackgroundTask(delivery);
            return;
          }
          return delivery;
        },
        signUpOnVerification: {
          getTempEmail: phoneToSyntheticEmail,
          getTempName: () => "New member"
        }
      })]
    : [];

  return betterAuth({
    appName: "BrightGlobe",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    trustedOrigins: buildTrustedOrigins(env.APP_ORIGINS, env.NODE_ENV),
    emailAndPassword: {
      enabled: env.EMAIL_ENABLED,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: ({ user, url }) =>
        deliverEmail(user.email, "reset", user.name, url)
    },
    emailVerification: env.EMAIL_ENABLED ? {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) =>
        deliverEmail(user.email, "verify", user.name, url)
    } : undefined,
    plugins: [expo(), ...phoneAuthPlugin],
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/phone-number/send-otp": { window: 60, max: 3 },
        "/phone-number/verify": { window: 60, max: 8 },
        "/sign-up/email": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
        "/request-password-reset": { window: 60, max: 3 }
      }
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      ...(scheduleBackgroundTask ? { backgroundTasks: { handler: scheduleBackgroundTask } } : {}),
      useSecureCookies: env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production"
      }
    }
  });
}

export type BetterAuthInstance = ReturnType<typeof createAuth>;

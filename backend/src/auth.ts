import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import type { AppEnvironment } from "./config/env.js";
import { buildTrustedOrigins } from "./config/origins.js";
import type { Database } from "./db/client.js";
import { isE164PhoneNumber, phoneToSyntheticEmail } from "./domain/phone.js";
import { dispatchPhoneOtp } from "./services/sms.js";

export type BackgroundTaskScheduler = (promise: Promise<unknown>) => void;

export function createAuth(db: Database, env: AppEnvironment, scheduleBackgroundTask?: BackgroundTaskScheduler) {
  return betterAuth({
    appName: "BrightGlobe",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg" }),
    trustedOrigins: buildTrustedOrigins(env.APP_ORIGINS, env.NODE_ENV),
    plugins: [
      expo(),
      phoneNumber({
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
      })
    ],
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
        "/phone-number/verify": { window: 60, max: 8 }
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

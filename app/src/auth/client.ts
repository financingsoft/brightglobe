import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
export const isAuthConfigured = apiBaseUrl.length > 0;

// Keep the client constructible in a non-auth preview build. Auth hooks are
// mounted only when a real API origin is configured.
export const authClient = createAuthClient({
  baseURL: apiBaseUrl || "http://127.0.0.1:4000",
  plugins: [
    expoClient({
      scheme: "brightglobe",
      storagePrefix: "brightglobe",
      storage: SecureStore
    }),
    phoneNumberClient()
  ]
});

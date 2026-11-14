import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ?? "";
export const isAuthConfigured = apiBaseUrl.length > 0;

// The native Expo plugin persists Better Auth's session cookie in SecureStore.
export const authClient = createAuthClient({
  baseURL: apiBaseUrl || "http://127.0.0.1:4000",
  plugins: [
    expoClient({
      scheme: "brightglobe",
      storagePrefix: "brightglobe",
      storage: SecureStore
    })
  ]
});

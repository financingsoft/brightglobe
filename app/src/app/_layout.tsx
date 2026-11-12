import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { LocaleProvider } from "@/i18n/locale";
import { AuthProvider } from "@/auth/session";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas }
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="activity" />
          <Stack.Screen name="announcement-detail" />
          <Stack.Screen name="announcements" />
          <Stack.Screen name="base" />
          <Stack.Screen name="category" />
          <Stack.Screen name="force-record" />
          <Stack.Screen name="help" />
          <Stack.Screen name="invite" />
          <Stack.Screen name="official-follow" />
          <Stack.Screen name="passport" />
          <Stack.Screen name="points-record" />
          <Stack.Screen name="rewards" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="wallet" />
          <Stack.Screen name="login" />
          <Stack.Screen name="+not-found" />
        </Stack>
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

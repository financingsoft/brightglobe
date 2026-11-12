import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "@/i18n/locale";
import { colors } from "@/constants/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <StatusBar style="dark" backgroundColor={colors.canvas} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas }
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
        </Stack>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

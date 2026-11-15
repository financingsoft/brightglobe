import type { ReactNode } from "react";
import { View } from "react-native";
import { AppKit, AppKitProvider } from "@reown/appkit-react-native";
import { appKit } from "./appkit";

export function WalletKitProvider({ children }: { children: ReactNode }) {
  if (!appKit) return <>{children}</>;

  return (
    <AppKitProvider instance={appKit}>
      {children}
      <View pointerEvents="box-none" style={styles.modalLayer}>
        <AppKit />
      </View>
    </AppKitProvider>
  );
}

const styles = {
  modalLayer: {
    position: "absolute" as const,
    width: "100%" as const,
    height: "100%" as const
  }
};

import "@walletconnect/react-native-compat";
import "react-native-get-random-values";
import "text-encoding";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAppKit, type AppKitNetwork } from "@reown/appkit-react-native";
import {
  PhantomConnector,
  SolanaAdapter,
  SolflareConnector
} from "@reown/appkit-solana-react-native";

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID?.trim();

export const SOLANA_DEVNET_CHAIN_ID = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
export const SOLANA_DEVNET_CAIP_ID = `solana:${SOLANA_DEVNET_CHAIN_ID}`;

const solanaDevnet = {
  id: SOLANA_DEVNET_CHAIN_ID,
  chainNamespace: "solana",
  caipNetworkId: SOLANA_DEVNET_CAIP_ID,
  name: "Solana Devnet",
  nativeCurrency: { name: "Solana", symbol: "SOL", decimals: 9 },
  rpcUrls: {
    default: { http: ["https://api.devnet.solana.com"] }
  },
  blockExplorers: {
    default: {
      name: "Solana Explorer",
      url: "https://explorer.solana.com/?cluster=devnet"
    }
  },
  testnet: true
} satisfies AppKitNetwork;

const storage = {
  async getKeys() {
    return AsyncStorage.getAllKeys();
  },
  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    return entries.flatMap(([key, value]) => {
      if (value === null) return [];
      try {
        return [[key, JSON.parse(value) as T] as [string, T]];
      } catch {
        return [[key, value as T] as [string, T]];
      }
    });
  },
  async getItem<T = unknown>(key: string): Promise<T | undefined> {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  },
  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  }
};

export const walletKitConfigured = Boolean(projectId);

export const appKit = projectId
  ? createAppKit({
      projectId,
      adapters: [new SolanaAdapter()],
      networks: [solanaDevnet],
      defaultNetwork: solanaDevnet,
      storage,
      metadata: {
        name: "BrightGlobe",
        description: "BrightGlobe Devnet wallet authentication",
        url: "https://globeapps.com",
        icons: [],
        redirect: { native: "brightglobe://" }
      },
      features: {
        analytics: false,
        email: false,
        socials: [],
        swaps: false,
        onramp: false
      },
      extraConnectors: [
        new PhantomConnector({ cluster: "devnet" }),
        new SolflareConnector({ cluster: "devnet" })
      ],
      themeMode: "dark",
      themeVariables: { accent: "#8B70D6" }
    })
  : null;

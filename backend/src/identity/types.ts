import type { canonicalUsers } from "../db/schema.js";

export type CanonicalUserStatus = "active" | "suspended" | "closed";
export type IdentityProvider = "better_auth_email" | "solana_wallet";
export type CanonicalUser = typeof canonicalUsers.$inferSelect;

export interface ProviderIdentity {
  id: string;
  canonicalUserId: string;
  provider: IdentityProvider;
  providerSubject: string;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface WalletOwnership {
  id: string;
  canonicalUserId: string;
  network: "devnet" | "mainnet-beta";
  address: string;
  verifiedAt: Date;
  createdAt: Date;
}

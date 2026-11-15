import { isValidSolanaAddress } from "../../blockchain/solana/address.js";

export type WalletNetwork = "devnet" | "mainnet-beta";

export interface WalletSignInMessageInput {
  domain: string;
  uri: string;
  address: string;
  network: WalletNetwork;
  purpose?: "sign_in" | "link";
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
}

export function buildWalletSignInMessage(input: WalletSignInMessageInput): string {
  if (!isValidSolanaAddress(input.address)) throw new TypeError("Invalid Solana wallet address.");
  if (!/^[a-z0-9]{32,96}$/i.test(input.nonce)) throw new TypeError("Invalid wallet sign-in nonce.");
  const parsedUri = new URL(input.uri);
  if (parsedUri.host !== input.domain) throw new TypeError("Wallet sign-in URI host must match its domain.");
  if (parsedUri.protocol !== "https:" && parsedUri.hostname !== "localhost") {
    throw new TypeError("Wallet sign-in URI must use HTTPS.");
  }
  if (input.expiresAt.getTime() <= input.issuedAt.getTime()) {
    throw new TypeError("Wallet sign-in expiration must be after issue time.");
  }

  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    "",
    input.purpose === "link" ? "Link this wallet to your BrightGlobe account." : "Sign in to BrightGlobe.",
    "",
    `URI: ${parsedUri.toString()}`,
    "Version: 1",
    `Chain ID: solana:${input.network}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`
  ].join("\n");
}

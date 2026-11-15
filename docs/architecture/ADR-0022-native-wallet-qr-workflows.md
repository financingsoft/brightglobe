# ADR-0022: Native Wallet QR Receive and Scan

- Status: Proposed for review
- Date: 2026-11-15
- Scope: BrightGlobe native App wallet receive and recipient entry

## Context

The native App needs a minimal way to receive a wallet address and enter a recipient without implementing QR rendering, camera access, barcode decoding or clipboard APIs from scratch.

## Decisions

- Use \`react-native-qrcode-svg@6.3.54\` (MIT) to render the currently connected, verified Solana Devnet wallet address as a QR code.
- Use \`expo-camera@~58.0.14\` (MIT) \`CameraView\` with QR-only barcode scanning to scan recipient addresses.
- Use \`expo-clipboard@~58.0.4\` (MIT) to copy the current receive address.
- Use the existing \`bs58\` dependency to decode scanned Base58 values and require exactly 32 bytes before populating the recipient field.
- Accept a plain Solana address or a \`solana:\` URI containing an address. Query parameters are not used to set a transfer amount or other transaction fields.
- A scanned address is placed into the editable recipient field. The user must review it and explicitly initiate the transfer; scanning never submits a transaction.
- Camera permission is requested only when the user taps Scan. The App does not request microphone permission or record audio.

## Safety boundaries

- The QR code represents a wallet address only; it is not a Solana Pay payment request and does not contain a token amount.
- Displayed receive address and chain are explicitly Devnet.
- Scanning a QR code does not establish wallet ownership, link an identity, or authenticate a BrightGlobe session.
- The existing backend remains responsible for validating that the source wallet is linked to the authenticated canonical user.
- The existing transaction-intent, external-wallet signature, finalized-chain verification and ledger-settlement requirements remain unchanged.
- No Mainnet transaction, token transfer, withdrawal, mint, burn, swap or reward activation is enabled by this feature.

## Consequences

BrightGlobe reuses maintained Expo and React Native libraries for camera, QR and clipboard workflows. BrightGlobe retains only the small adapter that validates scanned Base58 public-key bytes and places the address into the transfer form.

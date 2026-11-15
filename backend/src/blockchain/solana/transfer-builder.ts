import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction
} from "@solana-program/token";

export interface ClassicSplTransferBuildInput {
  feePayerAddress: string;
  destinationOwnerAddress: string;
  mintAddress: string;
  amountBaseUnits: bigint;
  decimals: number;
  recentBlockhash: string;
  lastValidBlockHeight: bigint;
}

export interface ClassicSplTransferBuildResult {
  transactionBase64: string;
  sourceTokenAccount: string;
  destinationTokenAccount: string;
}

/**
 * Derive canonical classic SPL Associated Token Accounts using the official
 * Token Program client. The source ATA must already exist; the destination ATA
 * is created idempotently inside the transfer transaction.
 */
export async function deriveClassicSplAssociatedTokenAccounts(input: {
  sourceOwnerAddress: string;
  destinationOwnerAddress: string;
  mintAddress: string;
}): Promise<{ sourceTokenAccount: string; destinationTokenAccount: string }> {
  const mint = address(input.mintAddress);
  const tokenProgram = TOKEN_PROGRAM_ADDRESS;
  const [sourceAta] = await findAssociatedTokenPda({
    owner: address(input.sourceOwnerAddress),
    tokenProgram,
    mint
  });
  const [destinationAta] = await findAssociatedTokenPda({
    owner: address(input.destinationOwnerAddress),
    tokenProgram,
    mint
  });

  return {
    sourceTokenAccount: sourceAta,
    destinationTokenAccount: destinationAta
  };
}

/**
 * Build an unsigned v0 transaction containing an idempotent destination ATA
 * creation followed by a checked classic SPL Token transfer.
 *
 * The noop signer is only a signer marker. It never signs; the connected
 * external wallet receives the serialized message and performs the signature
 * and broadcast itself.
 */
export async function buildClassicSplTransferTransaction(
  input: ClassicSplTransferBuildInput
): Promise<ClassicSplTransferBuildResult> {
  if (input.feePayerAddress === input.destinationOwnerAddress) {
    throw new TypeError("The transfer source and destination must be different.");
  }
  if (input.amountBaseUnits <= 0n || input.amountBaseUnits > 18446744073709551615n) {
    throw new RangeError("Classic SPL Token transfer amount must fit a positive u64.");
  }
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 18) {
    throw new RangeError("Token decimals must be an integer between 0 and 18.");
  }
  if (input.lastValidBlockHeight < 0n) {
    throw new RangeError("The last valid block height cannot be negative.");
  }

  const feePayer = createNoopSigner(address(input.feePayerAddress));
  const mint = address(input.mintAddress);
  const [sourceAta] = await findAssociatedTokenPda({
    owner: feePayer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint
  });
  const [destinationAta] = await findAssociatedTokenPda({
    owner: address(input.destinationOwnerAddress),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint
  });

  const createDestinationAta = getCreateAssociatedTokenIdempotentInstruction({
    payer: feePayer,
    ata: destinationAta,
    owner: address(input.destinationOwnerAddress),
    mint
  });

  const transfer = getTransferCheckedInstruction({
    source: sourceAta,
    mint,
    destination: destinationAta,
    authority: feePayer,
    amount: input.amountBaseUnits,
    decimals: input.decimals
  });

  const emptyMessage = createTransactionMessage({ version: 0 });
  const withFeePayer = setTransactionMessageFeePayer(feePayer.address, emptyMessage);
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash({
    blockhash: address(input.recentBlockhash) as Blockhash,
    lastValidBlockHeight: input.lastValidBlockHeight
  }, withFeePayer);
  const message = appendTransactionMessageInstructions(
    [createDestinationAta, transfer],
    withLifetime
  );

  const transaction = compileTransaction(message);
  return {
    transactionBase64: getBase64EncodedWireTransaction(transaction),
    sourceTokenAccount: sourceAta,
    destinationTokenAccount: destinationAta
  };
}

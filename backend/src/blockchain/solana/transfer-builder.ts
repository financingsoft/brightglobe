import {
  address,
  blockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedInstruction
} from "@solana-program/token";

export interface ClassicSplTransferBuildInput {
  /** Pays the network fee and destination ATA rent. Must not own the treasury ATA. */
  feePayerAddress: string;
  /** Owner/transfer authority of the pre-funded treasury source ATA. */
  treasuryAuthorityAddress: string;
  /** Self-custodial recipient wallet owner. */
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
  feePayerAddress: string;
  treasuryAuthorityAddress: string;
}

/**
 * Derive one wallet's classic SPL Associated Token Account using the official
 * Token Program client.
 */
export async function deriveClassicSplAssociatedTokenAddress(input: {
  ownerAddress: string;
  mintAddress: string;
}): Promise<string> {
  const [tokenAccount] = await findAssociatedTokenPda({
    owner: address(input.ownerAddress),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    mint: address(input.mintAddress)
  });
  return tokenAccount;
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
 * Build an unsigned v0 transaction with distinct signing roles:
 * - Fee Payer pays transaction fees and destination ATA rent.
 * - Treasury Authority owns the source ATA and authorizes TransferChecked.
 * - Recipient owns the destination ATA and never signs this payout.
 *
 * Both signers are noop markers only. A constrained external signer must
 * independently decode and approve the exact message before signing. This
 * function never signs or broadcasts a transaction.
 */
export async function buildClassicSplTransferTransaction(
  input: ClassicSplTransferBuildInput
): Promise<ClassicSplTransferBuildResult> {
  if (
    input.feePayerAddress === input.treasuryAuthorityAddress ||
    input.feePayerAddress === input.destinationOwnerAddress ||
    input.treasuryAuthorityAddress === input.destinationOwnerAddress
  ) {
    throw new TypeError("Fee payer, treasury authority and recipient must be three different wallets.");
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
  const treasuryAuthority = createNoopSigner(address(input.treasuryAuthorityAddress));
  const mint = address(input.mintAddress);
  const [sourceAta] = await findAssociatedTokenPda({
    owner: treasuryAuthority.address,
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
    authority: treasuryAuthority,
    amount: input.amountBaseUnits,
    decimals: input.decimals
  });

  const emptyMessage = createTransactionMessage({ version: 0 });
  const withFeePayer = setTransactionMessageFeePayer(feePayer.address, emptyMessage);
  const withLifetime = setTransactionMessageLifetimeUsingBlockhash({
    blockhash: blockhash(input.recentBlockhash),
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
    destinationTokenAccount: destinationAta,
    feePayerAddress: input.feePayerAddress,
    treasuryAuthorityAddress: input.treasuryAuthorityAddress
  };
}

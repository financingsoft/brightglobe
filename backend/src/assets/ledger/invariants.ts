export interface LedgerPostingInput {
  accountId: string;
  deltaBaseUnits: bigint;
}

export function assertBalancedPostings(postings: readonly LedgerPostingInput[]): void {
  if (postings.length < 2) throw new TypeError("A ledger transaction requires at least two postings.");
  const accountIds = new Set<string>();
  let total = 0n;
  for (const posting of postings) {
    if (!posting.accountId) throw new TypeError("Every ledger posting requires an account ID.");
    if (accountIds.has(posting.accountId)) throw new TypeError("A ledger transaction may post to each account only once.");
    accountIds.add(posting.accountId);
    if (posting.deltaBaseUnits === 0n) throw new TypeError("Ledger postings cannot be zero.");
    total += posting.deltaBaseUnits;
  }
  if (total !== 0n) throw new RangeError("Ledger postings must sum to zero base units.");
}

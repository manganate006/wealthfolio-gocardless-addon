import type { Transaction } from '../types/gocardless';
import type { ActivityImport, ActivityType } from '../types/wealthfolio';

/**
 * Maps a GoCardless transaction to a Wealthfolio Activity
 */
export function mapTransactionToActivity(
  transaction: Transaction,
  wealthfolioAccountId: string
): ActivityImport | null {
  const amount = parseFloat(transaction.transactionAmount.amount);
  const currency = transaction.transactionAmount.currency;

  // Skip zero-amount transactions
  if (amount === 0) return null;

  // Determine activity type based on amount sign
  const activityType: ActivityType = amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL';

  // Get the best available date
  const activityDate = getTransactionDate(transaction);
  if (!activityDate) return null;

  // Build description from available fields
  const comment = buildTransactionComment(transaction);

  return {
    accountId: wealthfolioAccountId,
    activityType,
    activityDate,
    quantity: 1,
    unitPrice: Math.abs(amount),
    currency,
    fee: 0,
    comment,
  };
}

/**
 * Gets the best available date from a transaction
 */
function getTransactionDate(transaction: Transaction): string | null {
  // Prefer bookingDate, then valueDate
  if (transaction.bookingDate) {
    return transaction.bookingDate;
  }
  if (transaction.bookingDateTime) {
    return transaction.bookingDateTime.split('T')[0];
  }
  if (transaction.valueDate) {
    return transaction.valueDate;
  }
  if (transaction.valueDateTime) {
    return transaction.valueDateTime.split('T')[0];
  }
  return null;
}

/**
 * Builds a descriptive comment from transaction fields
 */
function buildTransactionComment(transaction: Transaction): string {
  const parts: string[] = [];

  // Add counterparty name
  const counterparty = transaction.creditorName || transaction.debtorName;
  if (counterparty) {
    parts.push(counterparty);
  }

  // Add remittance information
  if (transaction.remittanceInformationUnstructured) {
    parts.push(transaction.remittanceInformationUnstructured);
  } else if (
    transaction.remittanceInformationUnstructuredArray &&
    transaction.remittanceInformationUnstructuredArray.length > 0
  ) {
    parts.push(transaction.remittanceInformationUnstructuredArray.join(' '));
  } else if (transaction.remittanceInformationStructured) {
    parts.push(transaction.remittanceInformationStructured);
  }

  // Add additional information if available
  if (transaction.additionalInformation && parts.length === 0) {
    parts.push(transaction.additionalInformation);
  }

  // Add transaction ID for reference
  const txId = transaction.transactionId || transaction.internalTransactionId;
  if (txId) {
    parts.push(`[Ref: ${txId}]`);
  }

  return parts.join(' - ').trim() || 'Bank transaction';
}

/**
 * Formats currency amount for display
 */
export function formatAmount(amount: string, currency: string): string {
  const numAmount = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(numAmount);
}

/**
 * Gets transaction display info
 */
export function getTransactionDisplayInfo(transaction: Transaction): {
  date: string;
  amount: string;
  formattedAmount: string;
  type: 'credit' | 'debit';
  counterparty: string;
  description: string;
} {
  const amount = parseFloat(transaction.transactionAmount.amount);
  const currency = transaction.transactionAmount.currency;

  return {
    date: getTransactionDate(transaction) || 'Unknown',
    amount: transaction.transactionAmount.amount,
    formattedAmount: formatAmount(transaction.transactionAmount.amount, currency),
    type: amount > 0 ? 'credit' : 'debit',
    counterparty: transaction.creditorName || transaction.debtorName || 'Unknown',
    description:
      transaction.remittanceInformationUnstructured ||
      transaction.remittanceInformationUnstructuredArray?.join(' ') ||
      transaction.additionalInformation ||
      '',
  };
}

/**
 * Groups transactions by date
 */
export function groupTransactionsByDate(
  transactions: Transaction[]
): Map<string, Transaction[]> {
  const grouped = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const date = getTransactionDate(tx) || 'Unknown';
    const existing = grouped.get(date) || [];
    existing.push(tx);
    grouped.set(date, existing);
  }

  // Sort by date descending
  return new Map(
    [...grouped.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  );
}

/**
 * Calculates transaction summary
 */
export function calculateTransactionSummary(transactions: Transaction[]): {
  totalCredits: number;
  totalDebits: number;
  netAmount: number;
  currency: string;
  count: number;
} {
  let totalCredits = 0;
  let totalDebits = 0;
  let currency = 'EUR';

  for (const tx of transactions) {
    const amount = parseFloat(tx.transactionAmount.amount);
    currency = tx.transactionAmount.currency;

    if (amount > 0) {
      totalCredits += amount;
    } else {
      totalDebits += Math.abs(amount);
    }
  }

  return {
    totalCredits,
    totalDebits,
    netAmount: totalCredits - totalDebits,
    currency,
    count: transactions.length,
  };
}

/**
 * Deduplicates transactions based on transactionId
 */
export function deduplicateTransactions(transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  const unique: Transaction[] = [];

  for (const tx of transactions) {
    const id = tx.transactionId || tx.internalTransactionId;
    if (id && !seen.has(id)) {
      seen.add(id);
      unique.push(tx);
    } else if (!id) {
      // Keep transactions without ID (can't deduplicate)
      unique.push(tx);
    }
  }

  return unique;
}

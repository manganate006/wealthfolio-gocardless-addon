// GoCardless Bank Account Data API Types

export interface GoCardlessCredentials {
  secretId: string;
  secretKey: string;
}

export interface GoCardlessTokens {
  access: string;
  accessExpires: number;
  refresh: string;
  refreshExpires: number;
}

export interface Institution {
  id: string;
  name: string;
  bic: string;
  transactionTotalDays: string;
  countries: string[];
  logo: string;
}

export interface EndUserAgreement {
  id: string;
  created: string;
  institutionId: string;
  maxHistoricalDays: number;
  accessValidForDays: number;
  accessScope: string[];
  accepted: string | null;
}

export interface Requisition {
  id: string;
  created: string;
  redirect: string;
  status: RequisitionStatus;
  institutionId: string;
  agreement: string;
  reference: string;
  accounts: string[];
  userLanguage: string;
  link: string;
  ssn: string | null;
  accountSelection: boolean;
  redirectImmediate: boolean;
}

export type RequisitionStatus =
  | 'CR' // Created
  | 'GC' // Giving consent
  | 'UA' // Undergoing authentication
  | 'RJ' // Rejected
  | 'SA' // Selecting accounts
  | 'GA' // Granting access
  | 'LN' // Linked
  | 'SU' // Suspended
  | 'EX'; // Expired

export interface BankAccount {
  id: string;
  created: string;
  lastAccessed: string;
  iban: string;
  institutionId: string;
  status: AccountStatus;
  ownerName: string;
}

export type AccountStatus =
  | 'DISCOVERED'
  | 'PROCESSING'
  | 'ERROR'
  | 'EXPIRED'
  | 'READY'
  | 'SUSPENDED';

export interface AccountDetails {
  resourceId?: string;
  iban?: string;
  bban?: string;
  currency: string;
  ownerName?: string;
  name?: string;
  displayName?: string;
  product?: string;
  cashAccountType?: string;
  status?: 'enabled' | 'deleted' | 'blocked';
  usage?: 'PRIV' | 'ORGA';
}

export interface AccountBalance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
  referenceDate?: string;
}

export interface Transaction {
  transactionId?: string;
  internalTransactionId?: string;
  bookingDate?: string;
  bookingDateTime?: string;
  valueDate?: string;
  valueDateTime?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  creditorName?: string;
  creditorAccount?: {
    iban?: string;
    bban?: string;
  };
  debtorName?: string;
  debtorAccount?: {
    iban?: string;
    bban?: string;
  };
  remittanceInformationUnstructured?: string;
  remittanceInformationUnstructuredArray?: string[];
  remittanceInformationStructured?: string;
  bankTransactionCode?: string;
  proprietaryBankTransactionCode?: string;
  additionalInformation?: string;
  purposeCode?: string;
  endToEndId?: string;
  mandateId?: string;
  checkId?: string;
  currencyExchange?: CurrencyExchange[];
  balanceAfterTransaction?: AccountBalance;
  merchantCategoryCode?: string;
}

export interface CurrencyExchange {
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: string;
  quotationDate?: string;
}

export interface TransactionsResponse {
  booked: Transaction[];
  pending: Transaction[];
}

// API Response wrappers
export interface TokenResponse {
  access: string;
  access_expires: number;
  refresh: string;
  refresh_expires: number;
}

export interface InstitutionsResponse {
  institutions: Institution[];
}

export interface AccountDetailsResponse {
  account: AccountDetails;
}

export interface BalancesResponse {
  balances: AccountBalance[];
}

export interface TransactionsApiResponse {
  transactions: TransactionsResponse;
}

// Error types
export interface GoCardlessError {
  summary: string;
  detail: string;
  status_code: number;
}

// Stored data types
export interface LinkedBankAccount {
  id: string;
  requisitionId: string;
  institutionId: string;
  institutionName: string;
  iban?: string;
  ownerName?: string;
  currency: string;
  wealthfolioAccountId?: string;
  lastSyncedAt?: string;
}

export interface SyncResult {
  accountId: string;
  transactionsImported: number;
  transactionsSkipped: number;
  errors: string[];
}

import type {
  GoCardlessCredentials,
  GoCardlessTokens,
  Institution,
  EndUserAgreement,
  Requisition,
  AccountDetails,
  AccountBalance,
  TransactionsResponse,
  TokenResponse,
  GoCardlessError,
  BankAccount,
} from '../types/gocardless';
import type { SecretsAPI, LoggerAPI, HttpAPI } from '../types/wealthfolio';

const BASE_URL = 'https://bankaccountdata.gocardless.com/api/v2';

// Secret keys
const SECRETS = {
  CREDENTIALS: 'gocardless_credentials',
  TOKENS: 'gocardless_tokens',
  LINKED_ACCOUNTS: 'gocardless_linked_accounts',
  REQUISITIONS: 'gocardless_requisitions',
} as const;

export class GoCardlessClient {
  private secrets: SecretsAPI;
  private logger: LoggerAPI;
  private http: HttpAPI;
  private tokens: GoCardlessTokens | null = null;

  constructor(secrets: SecretsAPI, logger: LoggerAPI, http: HttpAPI) {
    this.secrets = secrets;
    this.logger = logger;
    this.http = http;
  }

  // ============ Credentials Management ============

  async saveCredentials(credentials: GoCardlessCredentials): Promise<void> {
    await this.secrets.set(SECRETS.CREDENTIALS, JSON.stringify(credentials));
    this.logger.info('GoCardless credentials saved');
  }

  async getCredentials(): Promise<GoCardlessCredentials | null> {
    const data = await this.secrets.get(SECRETS.CREDENTIALS);
    if (!data) return null;
    try {
      return JSON.parse(data) as GoCardlessCredentials;
    } catch {
      return null;
    }
  }

  async deleteCredentials(): Promise<void> {
    await this.secrets.delete(SECRETS.CREDENTIALS);
    await this.secrets.delete(SECRETS.TOKENS);
    this.tokens = null;
    this.logger.info('GoCardless credentials deleted');
  }

  async hasCredentials(): Promise<boolean> {
    const credentials = await this.getCredentials();
    return credentials !== null;
  }

  // ============ Token Management ============

  private async getStoredTokens(): Promise<GoCardlessTokens | null> {
    if (this.tokens) return this.tokens;
    const data = await this.secrets.get(SECRETS.TOKENS);
    if (!data) return null;
    try {
      this.tokens = JSON.parse(data) as GoCardlessTokens;
      return this.tokens;
    } catch {
      return null;
    }
  }

  private async saveTokens(tokens: GoCardlessTokens): Promise<void> {
    this.tokens = tokens;
    await this.secrets.set(SECRETS.TOKENS, JSON.stringify(tokens));
  }

  private isTokenExpired(expiresAt: number): boolean {
    // Add 5 minute buffer
    return Date.now() / 1000 > expiresAt - 300;
  }

  async getAccessToken(): Promise<string> {
    let tokens = await this.getStoredTokens();

    // If no tokens, create new ones
    if (!tokens) {
      tokens = await this.createNewTokens();
    }
    // If access token expired, refresh it
    else if (this.isTokenExpired(tokens.accessExpires)) {
      // If refresh token also expired, create new tokens
      if (this.isTokenExpired(tokens.refreshExpires)) {
        tokens = await this.createNewTokens();
      } else {
        tokens = await this.refreshAccessToken(tokens.refresh);
      }
    }

    return tokens.access;
  }

  private async createNewTokens(): Promise<GoCardlessTokens> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      throw new Error('GoCardless credentials not configured');
    }

    this.logger.info('Creating new GoCardless tokens');

    const response = await this.http.proxy({
      url: `${BASE_URL}/token/new/`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret_id: credentials.secretId,
        secret_key: credentials.secretKey,
      }),
    });

    if (response.status !== 200) {
      const error = this.parseErrorBody(response.body);
      throw new Error(`Failed to create tokens: ${error.detail}`);
    }

    const data: TokenResponse = JSON.parse(response.body);
    const tokens: GoCardlessTokens = {
      access: data.access,
      accessExpires: data.access_expires,
      refresh: data.refresh,
      refreshExpires: data.refresh_expires,
    };

    await this.saveTokens(tokens);
    return tokens;
  }

  private async refreshAccessToken(refreshToken: string): Promise<GoCardlessTokens> {
    this.logger.info('Refreshing GoCardless access token');

    const response = await this.http.proxy({
      url: `${BASE_URL}/token/refresh/`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.status !== 200) {
      // If refresh fails, try creating new tokens
      this.logger.warn('Token refresh failed, creating new tokens');
      return this.createNewTokens();
    }

    const data: TokenResponse = JSON.parse(response.body);
    const currentTokens = await this.getStoredTokens();

    const tokens: GoCardlessTokens = {
      access: data.access,
      accessExpires: data.access_expires,
      refresh: currentTokens?.refresh || refreshToken,
      refreshExpires: currentTokens?.refreshExpires || data.refresh_expires,
    };

    await this.saveTokens(tokens);
    return tokens;
  }

  // ============ API Helpers ============

  private parseErrorBody(body: string): GoCardlessError {
    try {
      return JSON.parse(body);
    } catch {
      return {
        summary: 'Unknown error',
        detail: body || 'Unknown error',
        status_code: 0,
      };
    }
  }

  private async apiRequest<T>(
    endpoint: string,
    options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; body?: string } = {}
  ): Promise<T> {
    const accessToken = await this.getAccessToken();

    const response = await this.http.proxy({
      url: `${BASE_URL}${endpoint}`,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body,
    });

    if (response.status < 200 || response.status >= 300) {
      const error = this.parseErrorBody(response.body);
      this.logger.error(`GoCardless API error: ${error.detail}`);
      throw new Error(error.detail || `API request failed: ${response.status}`);
    }

    return JSON.parse(response.body);
  }

  // ============ Institutions API ============

  async getInstitutions(country: string): Promise<Institution[]> {
    this.logger.info(`Fetching institutions for country: ${country}`);
    const data = await this.apiRequest<Institution[]>(
      `/institutions/?country=${country.toLowerCase()}`
    );
    return data;
  }

  async getInstitution(institutionId: string): Promise<Institution> {
    return this.apiRequest<Institution>(`/institutions/${institutionId}/`);
  }

  // ============ Agreements API ============

  async createAgreement(
    institutionId: string,
    maxHistoricalDays: number = 730,
    accessValidForDays: number = 90
  ): Promise<EndUserAgreement> {
    this.logger.info(`Creating agreement for institution: ${institutionId}`);

    return this.apiRequest<EndUserAgreement>('/agreements/enduser/', {
      method: 'POST',
      body: JSON.stringify({
        institution_id: institutionId,
        max_historical_days: maxHistoricalDays,
        access_valid_for_days: accessValidForDays,
        access_scope: ['balances', 'details', 'transactions'],
      }),
    });
  }

  // ============ Requisitions API ============

  async createRequisition(
    institutionId: string,
    redirectUrl: string,
    reference: string,
    agreementId?: string,
    userLanguage: string = 'EN'
  ): Promise<Requisition> {
    this.logger.info(`Creating requisition for institution: ${institutionId}`);

    const body: Record<string, unknown> = {
      institution_id: institutionId,
      redirect: redirectUrl,
      reference,
      user_language: userLanguage,
    };

    if (agreementId) {
      body.agreement = agreementId;
    }

    const requisition = await this.apiRequest<Requisition>('/requisitions/', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Store requisition for later retrieval
    await this.storeRequisition(requisition);

    return requisition;
  }

  async getRequisition(requisitionId: string): Promise<Requisition> {
    return this.apiRequest<Requisition>(`/requisitions/${requisitionId}/`);
  }

  async deleteRequisition(requisitionId: string): Promise<void> {
    await this.apiRequest(`/requisitions/${requisitionId}/`, {
      method: 'DELETE',
    });
    this.logger.info(`Deleted requisition: ${requisitionId}`);
  }

  private async storeRequisition(requisition: Requisition): Promise<void> {
    const stored = await this.getStoredRequisitions();
    stored[requisition.id] = requisition;
    await this.secrets.set(SECRETS.REQUISITIONS, JSON.stringify(stored));
  }

  async getStoredRequisitions(): Promise<Record<string, Requisition>> {
    const data = await this.secrets.get(SECRETS.REQUISITIONS);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  // ============ Accounts API ============

  async getAccountDetails(accountId: string): Promise<AccountDetails> {
    const data = await this.apiRequest<{ account: AccountDetails }>(
      `/accounts/${accountId}/details/`
    );
    return data.account;
  }

  async getAccountBalances(accountId: string): Promise<AccountBalance[]> {
    const data = await this.apiRequest<{ balances: AccountBalance[] }>(
      `/accounts/${accountId}/balances/`
    );
    return data.balances;
  }

  async getAccountTransactions(
    accountId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<TransactionsResponse> {
    let endpoint = `/accounts/${accountId}/transactions/`;
    const params: string[] = [];

    if (dateFrom) params.push(`date_from=${dateFrom}`);
    if (dateTo) params.push(`date_to=${dateTo}`);

    if (params.length > 0) {
      endpoint += `?${params.join('&')}`;
    }

    const data = await this.apiRequest<{ transactions: TransactionsResponse }>(endpoint);
    return data.transactions;
  }

  async getAccountMetadata(accountId: string): Promise<BankAccount> {
    return this.apiRequest<BankAccount>(`/accounts/${accountId}/`);
  }

  // ============ Linked Accounts Management ============

  async getLinkedAccounts(): Promise<Record<string, BankAccount & { wealthfolioAccountId?: string }>> {
    const data = await this.secrets.get(SECRETS.LINKED_ACCOUNTS);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveLinkedAccount(
    account: BankAccount,
    wealthfolioAccountId?: string
  ): Promise<void> {
    const linked = await this.getLinkedAccounts();
    linked[account.id] = { ...account, wealthfolioAccountId };
    await this.secrets.set(SECRETS.LINKED_ACCOUNTS, JSON.stringify(linked));
    this.logger.info(`Linked bank account: ${account.id}`);
  }

  async unlinkAccount(accountId: string): Promise<void> {
    const linked = await this.getLinkedAccounts();
    delete linked[accountId];
    await this.secrets.set(SECRETS.LINKED_ACCOUNTS, JSON.stringify(linked));
    this.logger.info(`Unlinked bank account: ${accountId}`);
  }

  async updateAccountMapping(
    bankAccountId: string,
    wealthfolioAccountId: string
  ): Promise<void> {
    const linked = await this.getLinkedAccounts();
    if (linked[bankAccountId]) {
      linked[bankAccountId].wealthfolioAccountId = wealthfolioAccountId;
      await this.secrets.set(SECRETS.LINKED_ACCOUNTS, JSON.stringify(linked));
      this.logger.info(`Updated account mapping: ${bankAccountId} -> ${wealthfolioAccountId}`);
    }
  }

  // ============ Sync Management ============

  async getLastSyncDate(accountId: string): Promise<string | null> {
    const key = `gocardless_last_sync_${accountId}`;
    return this.secrets.get(key);
  }

  async setLastSyncDate(accountId: string, date: string): Promise<void> {
    const key = `gocardless_last_sync_${accountId}`;
    await this.secrets.set(key, date);
  }
}

// Factory function for creating client instance
export function createGoCardlessClient(
  secrets: SecretsAPI,
  logger: LoggerAPI,
  http: HttpAPI
): GoCardlessClient {
  return new GoCardlessClient(secrets, logger, http);
}

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Building2,
  Unlink,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { AddonContext, Account } from '../types/wealthfolio';
import type { BankAccount, AccountDetails, AccountBalance } from '../types/gocardless';
import { createGoCardlessClient } from '../api/gocardless-client';
import { formatAmount } from '../utils/transaction-mapper';

interface AccountsPageProps {
  ctx: AddonContext;
}

interface LinkedAccountInfo {
  bankAccount: BankAccount & { wealthfolioAccountId?: string };
  details?: AccountDetails;
  balances?: AccountBalance[];
  lastSync?: string | null;
}

export function AccountsPage({ ctx }: AccountsPageProps) {
  const queryClient = useQueryClient();
  const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);

  // Fetch Wealthfolio accounts for mapping
  const { data: wealthfolioAccounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => ctx.api.accounts.getAll(),
  });

  // Fetch linked bank accounts
  const {
    data: linkedAccounts = {},
    isLoading,
    refetch: refetchLinked,
  } = useQuery({
    queryKey: ['gocardless', 'linkedAccounts'],
    queryFn: () => client.getLinkedAccounts(),
  });

  // Fetch details for each linked account
  const [accountDetails, setAccountDetails] = useState<Record<string, LinkedAccountInfo>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function fetchDetails() {
      const accounts = Object.values(linkedAccounts);
      for (const account of accounts) {
        if (accountDetails[account.id]) continue;

        setLoadingDetails((prev) => new Set(prev).add(account.id));
        try {
          const [details, balances, lastSync] = await Promise.all([
            client.getAccountDetails(account.id).catch(() => undefined),
            client.getAccountBalances(account.id).catch(() => undefined),
            client.getLastSyncDate(account.id),
          ]);

          setAccountDetails((prev) => ({
            ...prev,
            [account.id]: {
              bankAccount: account,
              details,
              balances,
              lastSync,
            },
          }));
        } catch (err) {
          ctx.api.logger.error(`Failed to fetch details for account ${account.id}`);
        } finally {
          setLoadingDetails((prev) => {
            const next = new Set(prev);
            next.delete(account.id);
            return next;
          });
        }
      }
    }

    if (Object.keys(linkedAccounts).length > 0) {
      fetchDetails();
    }
  }, [linkedAccounts]);

  // Update account mapping
  const updateMappingMutation = useMutation({
    mutationFn: async ({
      bankAccountId,
      wealthfolioAccountId,
    }: {
      bankAccountId: string;
      wealthfolioAccountId: string;
    }) => {
      await client.updateAccountMapping(bankAccountId, wealthfolioAccountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'linkedAccounts'] });
    },
  });

  // Unlink account
  const unlinkMutation = useMutation({
    mutationFn: async (bankAccountId: string) => {
      await client.unlinkAccount(bankAccountId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'linkedAccounts'] });
    },
  });

  const linkedAccountsList = Object.values(linkedAccounts);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Bank Accounts</h1>
            <p className="text-muted-foreground">
              Manage your connected bank accounts and link them to Wealthfolio
            </p>
          </div>
        </div>
        <button
          onClick={() => refetchLinked()}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Empty State */}
      {linkedAccountsList.length === 0 && (
        <div className="rounded-lg border bg-card p-12 text-center">
          <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-2">No Bank Accounts Connected</h2>
          <p className="text-muted-foreground mb-4">
            Connect your bank accounts to start syncing transactions
          </p>
          <button
            onClick={() => ctx.api.navigation.navigate('/addon/gocardless-bank/banks')}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Building2 className="h-4 w-4" />
            Connect Bank
          </button>
        </div>
      )}

      {/* Account List */}
      {linkedAccountsList.length > 0 && (
        <div className="space-y-4">
          {linkedAccountsList.map((account) => {
            const info = accountDetails[account.id];
            const isLoadingInfo = loadingDetails.has(account.id);

            return (
              <AccountCard
                key={account.id}
                account={account}
                info={info}
                isLoading={isLoadingInfo}
                wealthfolioAccounts={wealthfolioAccounts}
                onUpdateMapping={(wfAccountId) =>
                  updateMappingMutation.mutate({
                    bankAccountId: account.id,
                    wealthfolioAccountId: wfAccountId,
                  })
                }
                onUnlink={() => unlinkMutation.mutate(account.id)}
                isUpdating={updateMappingMutation.isPending}
              />
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Account Mapping</p>
        <p>
          Link each bank account to a Wealthfolio account to import transactions. If you
          don't have a matching account, create one in Wealthfolio first.
        </p>
      </div>
    </div>
  );
}

interface AccountCardProps {
  account: BankAccount & { wealthfolioAccountId?: string };
  info?: LinkedAccountInfo;
  isLoading: boolean;
  wealthfolioAccounts: Account[];
  onUpdateMapping: (wealthfolioAccountId: string) => void;
  onUnlink: () => void;
  isUpdating: boolean;
}

function AccountCard({
  account,
  info,
  isLoading,
  wealthfolioAccounts,
  onUpdateMapping,
  onUnlink,
  isUpdating,
}: AccountCardProps) {
  const details = info?.details;
  const balances = info?.balances;
  const currentBalance = balances?.find(
    (b) => b.balanceType === 'interimAvailable' || b.balanceType === 'expected'
  );

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">
              {details?.name || details?.product || 'Bank Account'}
            </h3>
            <p className="text-sm text-muted-foreground">{account.institutionId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account.wealthfolioAccountId ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded">
              <CheckCircle className="h-3 w-3" />
              Linked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded">
              <AlertCircle className="h-3 w-3" />
              Not Linked
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Account Details */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {details?.iban && (
                <div>
                  <p className="text-muted-foreground">IBAN</p>
                  <p className="font-mono">{formatIban(details.iban)}</p>
                </div>
              )}
              {details?.currency && (
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p>{details.currency}</p>
                </div>
              )}
              {currentBalance && (
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-semibold">
                    {formatAmount(
                      currentBalance.balanceAmount.amount,
                      currentBalance.balanceAmount.currency
                    )}
                  </p>
                </div>
              )}
              {info?.lastSync && (
                <div>
                  <p className="text-muted-foreground">Last Sync</p>
                  <p className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {info.lastSync}
                  </p>
                </div>
              )}
            </div>

            {/* Mapping */}
            <div className="flex items-center gap-4 pt-2 border-t">
              <div className="flex-1">
                <label className="text-sm font-medium">Link to Wealthfolio Account</label>
                <select
                  value={account.wealthfolioAccountId || ''}
                  onChange={(e) => onUpdateMapping(e.target.value)}
                  disabled={isUpdating}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select account...</option>
                  {wealthfolioAccounts.map((wfAccount) => (
                    <option key={wfAccount.id} value={wfAccount.id}>
                      {wfAccount.name} ({wfAccount.currency})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={onUnlink}
                className="mt-6 inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-600 hover:bg-red-500/20 dark:text-red-400"
              >
                <Unlink className="h-4 w-4" />
                Unlink
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatIban(iban: string): string {
  // Format IBAN in groups of 4 for readability
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

export default AccountsPage;

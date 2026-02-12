import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GoCardlessClient } from '../api/gocardless-client';
import type { BankAccount, AccountBalance, AccountDetails } from '../types/gocardless';
import type { Account } from '../types/wealthfolio';

interface UseBankAccountsOptions {
  client: GoCardlessClient;
  wealthfolioAccounts: Account[];
}

export interface LinkedBankAccount extends BankAccount {
  wealthfolioAccountId?: string;
  details?: AccountDetails;
  balances?: AccountBalance[];
  lastSyncedAt?: string;
}

export function useBankAccounts({ client, wealthfolioAccounts }: UseBankAccountsOptions) {
  const queryClient = useQueryClient();

  // Fetch linked accounts with details
  const {
    data: linkedAccounts,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['gocardless', 'accounts', 'linked'],
    queryFn: async (): Promise<LinkedBankAccount[]> => {
      const stored = await client.getLinkedAccounts();
      const accounts: LinkedBankAccount[] = [];

      for (const [id, account] of Object.entries(stored)) {
        try {
          const details = await client.getAccountDetails(id);
          const balances = await client.getAccountBalances(id);
          const lastSyncedAt = await client.getLastSyncDate(id);

          accounts.push({
            ...account,
            details,
            balances,
            lastSyncedAt: lastSyncedAt ?? undefined,
          });
        } catch (err) {
          // Account might be expired or inaccessible
          accounts.push({
            ...account,
            status: 'EXPIRED',
          });
        }
      }

      return accounts;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'accounts'] });
    },
  });

  // Unlink account
  const unlinkMutation = useMutation({
    mutationFn: (accountId: string) => client.unlinkAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'accounts'] });
    },
  });

  // Get mapped Wealthfolio account for a bank account
  const getWealthfolioAccount = (bankAccountId: string): Account | undefined => {
    const linked = linkedAccounts?.find((a) => a.id === bankAccountId);
    if (!linked?.wealthfolioAccountId) return undefined;
    return wealthfolioAccounts.find((a) => a.id === linked.wealthfolioAccountId);
  };

  // Get current balance for display
  const getCurrentBalance = (account: LinkedBankAccount): string | null => {
    if (!account.balances || account.balances.length === 0) return null;

    // Prefer closingBooked or expected balance
    const preferredTypes = ['closingBooked', 'expected', 'interimBooked', 'interimAvailable'];

    for (const type of preferredTypes) {
      const balance = account.balances.find((b) => b.balanceType === type);
      if (balance) {
        const amount = parseFloat(balance.balanceAmount.amount);
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: balance.balanceAmount.currency,
        }).format(amount);
      }
    }

    // Fallback to first available balance
    const firstBalance = account.balances[0];
    const amount = parseFloat(firstBalance.balanceAmount.amount);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: firstBalance.balanceAmount.currency,
    }).format(amount);
  };

  return {
    linkedAccounts: linkedAccounts ?? [],
    isLoading,
    error: error?.message ?? null,
    refetch,

    // Actions
    updateMapping: updateMappingMutation.mutate,
    isUpdatingMapping: updateMappingMutation.isPending,

    unlinkAccount: unlinkMutation.mutate,
    isUnlinking: unlinkMutation.isPending,

    // Helpers
    getWealthfolioAccount,
    getCurrentBalance,
    wealthfolioAccounts,
  };
}

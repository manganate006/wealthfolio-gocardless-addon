import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import type { GoCardlessClient } from '../api/gocardless-client';
import type { SyncResult } from '../types/gocardless';
import type { ActivitiesAPI, ActivityImport } from '../types/wealthfolio';
import { mapTransactionToActivity } from '../utils/transaction-mapper';

interface UseTransactionSyncOptions {
  client: GoCardlessClient;
  activitiesApi: ActivitiesAPI;
}

export interface SyncProgress {
  accountId: string;
  accountName: string;
  status: 'pending' | 'syncing' | 'success' | 'error';
  progress: number;
  result?: SyncResult;
  error?: string;
}

export function useTransactionSync({ client, activitiesApi }: UseTransactionSyncOptions) {
  const queryClient = useQueryClient();
  const [syncProgress, setSyncProgress] = useState<Record<string, SyncProgress>>({});

  // Sync a single account
  const syncAccountMutation = useMutation({
    mutationFn: async ({
      bankAccountId,
      wealthfolioAccountId,
      accountName,
      dateFrom,
      dateTo,
    }: {
      bankAccountId: string;
      wealthfolioAccountId: string;
      accountName: string;
      dateFrom?: string;
      dateTo?: string;
    }): Promise<SyncResult> => {
      // Update progress
      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: {
          accountId: bankAccountId,
          accountName,
          status: 'syncing',
          progress: 10,
        },
      }));

      // Get last sync date if no dateFrom provided
      let fromDate = dateFrom;
      if (!fromDate) {
        const lastSync = await client.getLastSyncDate(bankAccountId);
        fromDate = lastSync || format(subDays(new Date(), 90), 'yyyy-MM-dd');
      }

      const toDate = dateTo || format(new Date(), 'yyyy-MM-dd');

      // Fetch transactions
      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], progress: 30 },
      }));

      const transactions = await client.getAccountTransactions(
        bankAccountId,
        fromDate,
        toDate
      );

      // Get all transactions (booked + pending)
      const allTransactions = [...transactions.booked];
      // Optionally include pending transactions
      // allTransactions.push(...transactions.pending);

      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], progress: 50 },
      }));

      // Map to Wealthfolio activities
      const activities: ActivityImport[] = allTransactions
        .map((tx) => mapTransactionToActivity(tx, wealthfolioAccountId))
        .filter((a): a is ActivityImport => a !== null);

      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], progress: 70 },
      }));

      // Validate import
      const validation = await activitiesApi.checkImport(wealthfolioAccountId, activities);

      if (!validation.valid && validation.errors.length > 0) {
        const errors = validation.errors.map((e) => e.message);
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }

      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], progress: 85 },
      }));

      // Import activities
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      try {
        await activitiesApi.import(activities);
        imported = activities.length;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Import failed');
        skipped = activities.length;
      }

      // Update last sync date
      await client.setLastSyncDate(bankAccountId, toDate);

      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], progress: 100, status: 'success' },
      }));

      const result: SyncResult = {
        accountId: bankAccountId,
        transactionsImported: imported,
        transactionsSkipped: skipped,
        errors,
      };

      setSyncProgress((prev) => ({
        ...prev,
        [bankAccountId]: { ...prev[bankAccountId], result },
      }));

      return result;
    },
    onError: (error, variables) => {
      setSyncProgress((prev) => ({
        ...prev,
        [variables.bankAccountId]: {
          ...prev[variables.bankAccountId],
          status: 'error',
          error: error instanceof Error ? error.message : 'Sync failed',
        },
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'accounts'] });
    },
  });

  // Sync multiple accounts
  const syncAllAccounts = useCallback(
    async (
      accounts: Array<{
        bankAccountId: string;
        wealthfolioAccountId: string;
        accountName: string;
      }>,
      dateFrom?: string,
      dateTo?: string
    ): Promise<SyncResult[]> => {
      // Initialize progress for all accounts
      const initialProgress: Record<string, SyncProgress> = {};
      for (const account of accounts) {
        initialProgress[account.bankAccountId] = {
          accountId: account.bankAccountId,
          accountName: account.accountName,
          status: 'pending',
          progress: 0,
        };
      }
      setSyncProgress(initialProgress);

      // Sync sequentially to avoid rate limits
      const results: SyncResult[] = [];
      for (const account of accounts) {
        try {
          const result = await syncAccountMutation.mutateAsync({
            ...account,
            dateFrom,
            dateTo,
          });
          results.push(result);
        } catch (err) {
          results.push({
            accountId: account.bankAccountId,
            transactionsImported: 0,
            transactionsSkipped: 0,
            errors: [err instanceof Error ? err.message : 'Sync failed'],
          });
        }
      }

      return results;
    },
    [syncAccountMutation]
  );

  const resetProgress = useCallback(() => {
    setSyncProgress({});
  }, []);

  return {
    syncAccount: syncAccountMutation.mutate,
    syncAccountAsync: syncAccountMutation.mutateAsync,
    syncAllAccounts,
    isSyncing: syncAccountMutation.isPending,
    syncError: syncAccountMutation.error?.message ?? null,
    syncProgress,
    resetProgress,
  };
}

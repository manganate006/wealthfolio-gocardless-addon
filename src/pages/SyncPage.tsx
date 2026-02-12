import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Calendar,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { AddonContext } from '../types/wealthfolio';
import type { BankAccount } from '../types/gocardless';
import { createGoCardlessClient } from '../api/gocardless-client';
import { useTransactionSync, SyncProgress } from '../hooks/useTransactionSync';

interface SyncPageProps {
  ctx: AddonContext;
}

export function SyncPage({ ctx }: SyncPageProps) {
  const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);

  // Date range for sync
  const [dateFrom, setDateFrom] = useState(() =>
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Fetch linked accounts
  const { data: linkedAccounts = {}, isLoading } = useQuery({
    queryKey: ['gocardless', 'linkedAccounts'],
    queryFn: () => client.getLinkedAccounts(),
  });

  // Transaction sync hook
  const {
    syncAccount,
    syncAllAccounts,
    isSyncing,
    syncProgress,
    resetProgress,
  } = useTransactionSync({
    client,
    activitiesApi: ctx.api.activities,
  });

  // Filter accounts that are linked to Wealthfolio
  const syncableAccounts = useMemo(() => {
    return Object.values(linkedAccounts).filter((a) => a.wealthfolioAccountId);
  }, [linkedAccounts]);

  const unlinkedAccounts = useMemo(() => {
    return Object.values(linkedAccounts).filter((a) => !a.wealthfolioAccountId);
  }, [linkedAccounts]);

  const handleSyncAll = async () => {
    resetProgress();
    const accounts = syncableAccounts.map((a) => ({
      bankAccountId: a.id,
      wealthfolioAccountId: a.wealthfolioAccountId!,
      accountName: a.institutionId,
    }));
    await syncAllAccounts(accounts, dateFrom, dateTo);
  };

  const handleSyncAccount = (account: BankAccount & { wealthfolioAccountId?: string }) => {
    if (!account.wealthfolioAccountId) return;
    syncAccount({
      bankAccountId: account.id,
      wealthfolioAccountId: account.wealthfolioAccountId,
      accountName: account.institutionId,
      dateFrom,
      dateTo,
    });
  };

  // Calculate summary
  const summary = useMemo(() => {
    const results = Object.values(syncProgress);
    return {
      total: results.length,
      completed: results.filter((r) => r.status === 'success').length,
      errors: results.filter((r) => r.status === 'error').length,
      imported: results.reduce((sum, r) => sum + (r.result?.transactionsImported || 0), 0),
      skipped: results.reduce((sum, r) => sum + (r.result?.transactionsSkipped || 0), 0),
    };
  }, [syncProgress]);

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
      <div className="flex items-center gap-3">
        <RefreshCw className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Sync Transactions</h1>
          <p className="text-muted-foreground">
            Import bank transactions into Wealthfolio
          </p>
        </div>
      </div>

      {/* No Accounts Warning */}
      {syncableAccounts.length === 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">No accounts ready for sync</span>
          </div>
          <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-500">
            {Object.keys(linkedAccounts).length === 0
              ? 'Connect a bank account first, then link it to a Wealthfolio account.'
              : 'Link your bank accounts to Wealthfolio accounts on the Accounts page.'}
          </p>
        </div>
      )}

      {/* Date Range Selection */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">Date Range</h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="dateFrom" className="text-sm text-muted-foreground">
              From
            </label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <ArrowRight className="h-4 w-4 text-muted-foreground" />

          <div className="flex items-center gap-2">
            <label htmlFor="dateTo" className="text-sm text-muted-foreground">
              To
            </label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Quick date buttons */}
          <div className="flex gap-2 ml-auto">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                onClick={() => setDateFrom(format(subDays(new Date(), days), 'yyyy-MM-dd'))}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-accent"
              >
                Last {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sync All Button */}
      {syncableAccounts.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {syncableAccounts.length} account{syncableAccounts.length !== 1 ? 's' : ''} ready
            for sync
          </p>
          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Sync All Accounts
          </button>
        </div>
      )}

      {/* Sync Progress Summary */}
      {Object.keys(syncProgress).length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="font-semibold mb-3">Sync Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 rounded-md bg-muted/50">
              <p className="text-2xl font-bold">{summary.completed}/{summary.total}</p>
              <p className="text-xs text-muted-foreground">Accounts Synced</p>
            </div>
            <div className="p-3 rounded-md bg-green-500/10">
              <p className="text-2xl font-bold text-green-600">{summary.imported}</p>
              <p className="text-xs text-muted-foreground">Transactions Imported</p>
            </div>
            <div className="p-3 rounded-md bg-yellow-500/10">
              <p className="text-2xl font-bold text-yellow-600">{summary.skipped}</p>
              <p className="text-xs text-muted-foreground">Skipped</p>
            </div>
            <div className="p-3 rounded-md bg-red-500/10">
              <p className="text-2xl font-bold text-red-600">{summary.errors}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
          </div>
        </div>
      )}

      {/* Account List */}
      <div className="space-y-3">
        <h2 className="font-semibold">Accounts</h2>

        {syncableAccounts.map((account) => (
          <AccountSyncCard
            key={account.id}
            account={account}
            progress={syncProgress[account.id]}
            onSync={() => handleSyncAccount(account)}
            isSyncing={isSyncing}
          />
        ))}

        {/* Unlinked accounts */}
        {unlinkedAccounts.length > 0 && (
          <>
            <h3 className="font-medium text-muted-foreground pt-4">
              Not Linked to Wealthfolio
            </h3>
            {unlinkedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{account.institutionId}</p>
                    <p className="text-sm text-muted-foreground">
                      Link to a Wealthfolio account to enable sync
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Not linked</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

interface AccountSyncCardProps {
  account: BankAccount & { wealthfolioAccountId?: string };
  progress?: SyncProgress;
  onSync: () => void;
  isSyncing: boolean;
}

function AccountSyncCard({ account, progress, onSync, isSyncing }: AccountSyncCardProps) {
  const getStatusIcon = () => {
    if (!progress) return <Clock className="h-4 w-4 text-muted-foreground" />;

    switch (progress.status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Ready';

    switch (progress.status) {
      case 'pending':
        return 'Waiting...';
      case 'syncing':
        return `Syncing... ${progress.progress}%`;
      case 'success':
        return `${progress.result?.transactionsImported || 0} imported`;
      case 'error':
        return progress.error || 'Failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{account.institutionId}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {getStatusIcon()}
            <span>{getStatusText()}</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {progress?.status === 'syncing' && (
        <div className="flex-1 mx-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={onSync}
        disabled={isSyncing || progress?.status === 'syncing'}
        className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
      >
        <RefreshCw className="h-4 w-4" />
        Sync
      </button>
    </div>
  );
}

export default SyncPage;

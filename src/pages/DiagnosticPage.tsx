import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bug,
  Database,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Key,
  Building2,
  CreditCard,
} from 'lucide-react';
import type { AddonContext } from '../types/wealthfolio';
import { createGoCardlessClient } from '../api/gocardless-client';

interface DiagnosticPageProps {
  ctx: AddonContext;
}

interface ApiRequisitionStatus {
  id: string;
  status: string;
  accounts: string[];
  error?: string;
}

export function DiagnosticPage({ ctx }: DiagnosticPageProps) {
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isRelinking, setIsRelinking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);
  const queryClient = useQueryClient();

  // Check if credentials exist
  const { data: hasCredentials, isLoading: isLoadingCreds } = useQuery({
    queryKey: ['gocardless', 'hasCredentials'],
    queryFn: () => client.hasCredentials(),
  });

  // Check if tokens exist
  const { data: tokensData, isLoading: isLoadingTokens } = useQuery({
    queryKey: ['gocardless', 'tokens'],
    queryFn: async () => {
      const tokens = await ctx.api.secrets.get('gocardless_tokens');
      return tokens;
    },
  });

  // Get stored requisitions
  const { data: requisitions = {}, isLoading: isLoadingReqs } = useQuery({
    queryKey: ['gocardless', 'requisitions'],
    queryFn: () => client.getStoredRequisitions(),
  });

  // Get linked accounts
  const { data: linkedAccounts = {}, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['gocardless', 'linkedAccounts'],
    queryFn: () => client.getLinkedAccounts(),
  });

  // Check API status for each requisition
  const [apiStatus, setApiStatus] = useState<Record<string, ApiRequisitionStatus>>({});
  const [isCheckingApi, setIsCheckingApi] = useState(false);

  const checkApiStatus = async () => {
    setIsCheckingApi(true);
    setMessage(null);
    const status: Record<string, ApiRequisitionStatus> = {};

    for (const [id] of Object.entries(requisitions)) {
      try {
        const apiReq = await client.getRequisition(id);
        status[id] = {
          id,
          status: apiReq.status,
          accounts: apiReq.accounts || [],
        };
      } catch (err) {
        status[id] = {
          id,
          status: 'ERROR',
          accounts: [],
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    }

    setApiStatus(status);
    setIsCheckingApi(false);
  };

  // Cleanup obsolete requisitions
  const handleCleanup = async () => {
    setIsCleaningUp(true);
    setMessage(null);
    let cleaned = 0;

    try {
      for (const [id, status] of Object.entries(apiStatus)) {
        // Remove if status is UA (User Abandoned), EX (Expired), RJ (Rejected), etc.
        if (['UA', 'EX', 'RJ', 'SA', 'GA', 'ERROR'].includes(status.status)) {
          await client.removeStoredRequisition(id);
          cleaned++;
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'requisitions'] });
      setMessage({ type: 'success', text: `Cleaned up ${cleaned} obsolete requisition(s)` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Cleanup failed' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Re-link accounts from valid requisitions
  const handleRelink = async () => {
    setIsRelinking(true);
    setMessage(null);
    let relinked = 0;

    try {
      for (const [id, status] of Object.entries(apiStatus)) {
        if (status.status === 'LN' && status.accounts.length > 0) {
          // Get requisition details and save accounts
          const req = requisitions[id];
          if (req) {
            for (const accountId of status.accounts) {
              await client.linkAccount(accountId, req.institutionId);
              relinked++;
            }
          }
        }
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'linkedAccounts'] });
      setMessage({ type: 'success', text: `Re-linked ${relinked} account(s)` });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Re-link failed' });
    } finally {
      setIsRelinking(false);
    }
  };

  // Clear all data
  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear ALL GoCardless data? This cannot be undone.')) {
      return;
    }

    try {
      await ctx.api.secrets.delete('gocardless_tokens');
      await ctx.api.secrets.delete('gocardless_requisitions');
      await ctx.api.secrets.delete('gocardless_linked_accounts');
      queryClient.invalidateQueries({ queryKey: ['gocardless'] });
      setMessage({ type: 'success', text: 'All data cleared successfully' });
      setApiStatus({});
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Clear failed' });
    }
  };

  const hasTokens = typeof tokensData === 'string' && tokensData.length > 0;
  const requisitionList = Object.values(requisitions);
  const accountList = Object.values(linkedAccounts);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bug className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Diagnostic</h1>
          <p className="text-muted-foreground">
            Troubleshoot GoCardless connection issues
          </p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`flex items-center gap-2 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-600'
              : 'border-red-500/50 bg-red-500/10 text-red-600'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Stored Data Section */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Stored Data</h2>
        </div>

        <div className="grid gap-3">
          {/* Credentials */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span>API Credentials</span>
            </div>
            {isLoadingCreds ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasCredentials ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Configured
              </span>
            ) : (
              <span className="text-red-600 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> Not configured
              </span>
            )}
          </div>

          {/* Tokens */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span>Access Tokens</span>
            </div>
            {isLoadingTokens ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hasTokens ? (
              <span className="text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Present
              </span>
            ) : (
              <span className="text-yellow-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> Not present
              </span>
            )}
          </div>

          {/* Requisitions */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>Stored Requisitions</span>
            </div>
            {isLoadingReqs ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="font-mono">{requisitionList.length}</span>
            )}
          </div>

          {/* Linked Accounts */}
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span>Linked Accounts</span>
            </div>
            {isLoadingAccounts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="font-mono">{accountList.length}</span>
            )}
          </div>
        </div>
      </div>

      {/* Requisitions Detail */}
      {requisitionList.length > 0 && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Requisitions Status</h2>
            </div>
            <button
              onClick={checkApiStatus}
              disabled={isCheckingApi}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {isCheckingApi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Check API Status
            </button>
          </div>

          <div className="space-y-2">
            {requisitionList.map((req) => {
              const api = apiStatus[req.id];
              return (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="font-mono text-sm">{req.id.substring(0, 8)}...</p>
                    <p className="text-xs text-muted-foreground">
                      Institution: {req.institutionId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-sm">
                      <p>
                        Local:{' '}
                        <span
                          className={
                            req.status === 'LN' ? 'text-green-600' : 'text-yellow-600'
                          }
                        >
                          {req.status}
                        </span>
                      </p>
                      {api && (
                        <p>
                          API:{' '}
                          <span
                            className={
                              api.status === 'LN'
                                ? 'text-green-600'
                                : api.status === 'ERROR'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }
                          >
                            {api.status}
                          </span>
                          {api.accounts.length > 0 && (
                            <span className="text-muted-foreground">
                              {' '}
                              ({api.accounts.length} acc)
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Recovery Actions</h2>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRelink}
            disabled={isRelinking || Object.keys(apiStatus).length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isRelinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-link Accounts
          </button>

          <button
            onClick={handleCleanup}
            disabled={isCleaningUp || Object.keys(apiStatus).length === 0}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
          >
            {isCleaningUp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Cleanup Obsolete
          </button>

          <button
            onClick={handleClearAll}
            className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Data
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          <strong>Re-link Accounts:</strong> Re-saves accounts from valid (LN) requisitions.
          <br />
          <strong>Cleanup Obsolete:</strong> Removes requisitions with status UA, EX, RJ, etc.
          <br />
          <strong>Clear All Data:</strong> Removes all tokens, requisitions, and linked accounts.
        </p>
      </div>
    </div>
  );
}

export default DiagnosticPage;

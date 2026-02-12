import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Settings, Building2, CreditCard, RefreshCw } from 'lucide-react';
import type { AddonContext } from './types/wealthfolio';

// Create a QueryClient for the addon's React Query hooks
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Wrapper component that provides QueryClient context
function WithQueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Lazy load pages for code splitting
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const BanksPage = React.lazy(() => import('./pages/BanksPage'));
const AccountsPage = React.lazy(() => import('./pages/AccountsPage'));
const SyncPage = React.lazy(() => import('./pages/SyncPage'));

/**
 * GoCardless Bank Sync Addon for Wealthfolio
 *
 * This addon enables users to:
 * 1. Connect their bank accounts via GoCardless Open Banking
 * 2. Sync transactions automatically to Wealthfolio
 * 3. Map bank accounts to Wealthfolio accounts
 */
export default function enable(ctx: AddonContext) {
  ctx.api.logger.info('GoCardless Bank Sync addon loading...');

  // Register sidebar items
  const sidebarItems = [
    ctx.sidebar.addItem({
      id: 'gocardless-sync',
      label: 'Bank Sync',
      route: '/addon/gocardless-bank/sync',
      icon: <RefreshCw className="h-4 w-4" />,
      order: 100,
    }),
    ctx.sidebar.addItem({
      id: 'gocardless-accounts',
      label: 'Bank Accounts',
      route: '/addon/gocardless-bank/accounts',
      icon: <CreditCard className="h-4 w-4" />,
      order: 101,
    }),
    ctx.sidebar.addItem({
      id: 'gocardless-banks',
      label: 'Connect Banks',
      route: '/addon/gocardless-bank/banks',
      icon: <Building2 className="h-4 w-4" />,
      order: 102,
    }),
    ctx.sidebar.addItem({
      id: 'gocardless-settings',
      label: 'GoCardless Settings',
      route: '/addon/gocardless-bank/settings',
      icon: <Settings className="h-4 w-4" />,
      order: 103,
    }),
  ];

  // Register routes - all wrapped with QueryClientProvider
  ctx.router.add({
    path: '/addon/gocardless-bank/settings',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <WithQueryProvider>
            <React.Suspense fallback={<LoadingFallback />}>
              <SettingsPage ctx={ctx} />
            </React.Suspense>
          </WithQueryProvider>
        ),
      })
    ),
  });

  ctx.router.add({
    path: '/addon/gocardless-bank/banks',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <WithQueryProvider>
            <React.Suspense fallback={<LoadingFallback />}>
              <BanksPage ctx={ctx} />
            </React.Suspense>
          </WithQueryProvider>
        ),
      })
    ),
  });

  ctx.router.add({
    path: '/addon/gocardless-bank/accounts',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <WithQueryProvider>
            <React.Suspense fallback={<LoadingFallback />}>
              <AccountsPage ctx={ctx} />
            </React.Suspense>
          </WithQueryProvider>
        ),
      })
    ),
  });

  ctx.router.add({
    path: '/addon/gocardless-bank/sync',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <WithQueryProvider>
            <React.Suspense fallback={<LoadingFallback />}>
              <SyncPage ctx={ctx} />
            </React.Suspense>
          </WithQueryProvider>
        ),
      })
    ),
  });

  // Handle callback from bank authentication
  ctx.router.add({
    path: '/addon/gocardless-bank/callback',
    component: React.lazy(() =>
      Promise.resolve({
        default: () => (
          <WithQueryProvider>
            <React.Suspense fallback={<LoadingFallback />}>
              <CallbackPage ctx={ctx} />
            </React.Suspense>
          </WithQueryProvider>
        ),
      })
    ),
  });

  ctx.api.logger.info('GoCardless Bank Sync addon loaded successfully');

  // Return cleanup function
  return {
    disable() {
      // Remove all sidebar items
      sidebarItems.forEach((item) => item.remove());
      ctx.api.logger.info('GoCardless Bank Sync addon disabled');
    },
  };
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// Callback page after bank authentication
function CallbackPage({ ctx }: { ctx: AddonContext }) {
  const [status, setStatus] = React.useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = React.useState('Processing bank connection...');

  React.useEffect(() => {
    async function handleCallback() {
      try {
        // Get requisition ID from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');

        if (!ref) {
          setStatus('error');
          setMessage('Missing reference in callback URL');
          return;
        }

        // Import client dynamically to avoid circular dependencies
        const { createGoCardlessClient } = await import('./api/gocardless-client');
        const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);

        // Find the requisition by reference
        const requisitions = await client.getStoredRequisitions();
        const requisition = Object.values(requisitions).find(
          (r) => r.reference === ref || r.id === ref
        );

        if (!requisition) {
          setStatus('error');
          setMessage('Could not find the bank connection. Please try again.');
          return;
        }

        // Fetch updated requisition status
        const updatedRequisition = await client.getRequisition(requisition.id);

        if (updatedRequisition.status !== 'LN') {
          setStatus('error');
          setMessage(
            `Bank connection status: ${updatedRequisition.status}. Please try connecting again.`
          );
          return;
        }

        // Save linked accounts
        if (updatedRequisition.accounts && updatedRequisition.accounts.length > 0) {
          for (const accountId of updatedRequisition.accounts) {
            const accountMeta = await client.getAccountMetadata(accountId);
            await client.saveLinkedAccount(accountMeta);
          }
        }

        setStatus('success');
        setMessage(
          `Successfully connected ${updatedRequisition.accounts?.length || 0} account(s). Redirecting...`
        );

        // Redirect to accounts page after a short delay
        setTimeout(() => {
          ctx.api.navigation.navigate('/addon/gocardless-bank/accounts');
        }, 2000);
      } catch (err) {
        ctx.api.logger.error(`Callback error: ${err}`);
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'An error occurred');
      }
    }

    handleCallback();
  }, [ctx]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center p-8 max-w-md">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Processing</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-6 w-6 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-green-600">Success!</h2>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-6 w-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-red-600">Error</h2>
          </>
        )}
        <p className="text-muted-foreground">{message}</p>

        {status === 'error' && (
          <button
            onClick={() => ctx.api.navigation.navigate('/addon/gocardless-bank/banks')}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

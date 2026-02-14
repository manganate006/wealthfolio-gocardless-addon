import { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Save,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
} from 'lucide-react';
import type { AddonContext } from '../types/wealthfolio';
import type { GoCardlessCredentials } from '../types/gocardless';
import { createGoCardlessClient } from '../api/gocardless-client';

interface SettingsPageProps {
  ctx: AddonContext;
}

export function SettingsPage({ ctx }: SettingsPageProps) {
  const [secretId, setSecretId] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);

  // Load existing credentials
  useEffect(() => {
    async function loadCredentials() {
      try {
        const hasCredentials = await client.hasCredentials();
        setIsConfigured(hasCredentials);
        if (hasCredentials) {
          const credentials = await client.getCredentials();
          if (credentials) {
            setSecretId(credentials.secretId);
            setSecretKey('••••••••••••••••');
          }
        }
      } catch (err) {
        ctx.api.logger.error('Failed to load credentials');
      } finally {
        setIsLoading(false);
      }
    }
    loadCredentials();
  }, []);

  const handleSave = async () => {
    if (!secretId.trim() || !secretKey.trim()) {
      setError('Both Secret ID and Secret Key are required');
      return;
    }

    // Don't save if secretKey is masked
    if (secretKey === '••••••••••••••••') {
      setError('Please enter a new Secret Key to save');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const credentials: GoCardlessCredentials = {
        secretId: secretId.trim(),
        secretKey: secretKey.trim(),
      };
      await client.saveCredentials(credentials);
      setIsConfigured(true);
      setSecretKey('••••••••••••••••');
      ctx.api.logger.info('GoCardless credentials saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      // Try to get an access token - this validates the credentials
      await client.getAccessToken();
      setTestResult('success');
      ctx.api.logger.info('GoCardless connection test successful');
    } catch (err) {
      setTestResult('error');
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete your GoCardless credentials?')) {
      return;
    }

    setIsLoading(true);
    try {
      await client.deleteCredentials();
      setSecretId('');
      setSecretKey('');
      setIsConfigured(false);
      setTestResult(null);
      ctx.api.logger.info('GoCardless credentials deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credentials');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">GoCardless Settings</h1>
          <p className="text-muted-foreground">
            Configure your GoCardless Bank Account Data API credentials
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div
        className={`rounded-lg border p-4 ${
          isConfigured
            ? 'border-green-500/50 bg-green-500/10'
            : 'border-yellow-500/50 bg-yellow-500/10'
        }`}
      >
        <div className="flex items-center gap-2">
          {isConfigured ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Credentials Configured
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-yellow-700 dark:text-yellow-400">
                Credentials Not Configured
              </span>
            </>
          )}
        </div>
      </div>

      {/* Credentials Form */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">API Credentials</h2>
        </div>

        {/* Secret ID */}
        <div className="space-y-2">
          <label htmlFor="secretId" className="text-sm font-medium">
            Secret ID
          </label>
          <input
            id="secretId"
            type="text"
            value={secretId}
            onChange={(e) => setSecretId(e.target.value)}
            placeholder="Enter your GoCardless Secret ID"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Secret Key */}
        <div className="space-y-2">
          <label htmlFor="secretKey" className="text-sm font-medium">
            Secret Key
          </label>
          <div className="relative">
            <input
              id="secretKey"
              type={showSecretKey ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="Enter your GoCardless Secret Key"
              className="w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowSecretKey(!showSecretKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Test Result */}
        {testResult === 'success' && (
          <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Connection successful! Your credentials are valid.
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Credentials
          </button>

          {isConfigured && (
            <>
              <button
                onClick={handleTest}
                disabled={isTesting}
                className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Test Connection
              </button>

              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <h2 className="text-lg font-semibold">How to get credentials</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Go to the GoCardless Bank Account Data portal</li>
          <li>Navigate to the "User Secrets" section</li>
          <li>Create a new secret or use an existing one</li>
          <li>Copy the Secret ID and Secret Key</li>
          <li>Paste them in the form above</li>
        </ol>
        <a
          href="https://bankaccountdata.gocardless.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          Open GoCardless Portal
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Version Info */}
      <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-4">
          <span>
            <strong>Version:</strong> {__APP_VERSION__}
          </span>
          <span>
            <strong>Commit:</strong>{' '}
            <code className="bg-muted px-1 py-0.5 rounded">{__GIT_COMMIT__}</code>
          </span>
          <span>
            <strong>Built:</strong> {new Date(__BUILD_TIME__).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

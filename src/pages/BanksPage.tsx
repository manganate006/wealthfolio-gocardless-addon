import { useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Building2,
  Globe,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { AddonContext } from '../types/wealthfolio';
import type { Institution } from '../types/gocardless';
import { createGoCardlessClient } from '../api/gocardless-client';
import { BankSelector } from '../components/BankSelector';

interface BanksPageProps {
  ctx: AddonContext;
}

// European countries supported by GoCardless
const COUNTRIES = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'GB', name: 'United Kingdom' },
];

export function BanksPage({ ctx }: BanksPageProps) {
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedBank, setSelectedBank] = useState<Institution | null>(null);
  const [connectionStep, setConnectionStep] = useState<'select' | 'connecting' | 'redirect'>('select');

  const client = createGoCardlessClient(ctx.api.secrets, ctx.api.logger, ctx.api.http);

  // Fetch institutions for selected country
  const {
    data: institutions = [],
    isLoading: isLoadingBanks,
    error: banksError,
  } = useQuery({
    queryKey: ['gocardless', 'institutions', selectedCountry],
    queryFn: () => client.getInstitutions(selectedCountry),
    enabled: !!selectedCountry,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch existing requisitions
  const { data: requisitions = {} } = useQuery({
    queryKey: ['gocardless', 'requisitions'],
    queryFn: () => client.getStoredRequisitions(),
  });

  // Create connection mutation
  const connectMutation = useMutation({
    mutationFn: async (institution: Institution) => {
      setConnectionStep('connecting');

      // Create agreement
      const agreement = await client.createAgreement(
        institution.id,
        parseInt(institution.transactionTotalDays, 10) || 90,
        90
      );

      // Create requisition with redirect back to this addon
      const redirectUrl = `${window.location.origin}/addon/gocardless-bank/callback`;
      const reference = `wealthfolio-${Date.now()}`;

      const requisition = await client.createRequisition(
        institution.id,
        redirectUrl,
        reference,
        agreement.id
      );

      return requisition;
    },
    onSuccess: (requisition) => {
      setConnectionStep('redirect');
      // Open bank auth in new window
      window.open(requisition.link, '_blank');
    },
    onError: (error) => {
      ctx.api.logger.error(`Connection failed: ${error.message}`);
      setConnectionStep('select');
    },
  });

  const handleBankSelect = useCallback((institution: Institution) => {
    setSelectedBank(institution);
  }, []);

  const handleConnect = useCallback(() => {
    if (selectedBank) {
      connectMutation.mutate(selectedBank);
    }
  }, [selectedBank, connectMutation]);

  // Get connected banks from requisitions
  const connectedBanks = Object.values(requisitions).filter(
    (r) => r.status === 'LN' && r.accounts && r.accounts.length > 0
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Connect Banks</h1>
          <p className="text-muted-foreground">
            Link your bank accounts via GoCardless Open Banking
          </p>
        </div>
      </div>

      {/* Connected Banks */}
      {connectedBanks.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h2 className="font-semibold flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Connected Banks
          </h2>
          <div className="grid gap-2">
            {connectedBanks.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{req.institutionId}</p>
                    <p className="text-sm text-muted-foreground">
                      {req.accounts?.length || 0} account(s) linked
                    </p>
                  </div>
                </div>
                <span className="text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Country Selection */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Select Country</h2>
        </div>

        <select
          value={selectedCountry}
          onChange={(e) => {
            setSelectedCountry(e.target.value);
            setSelectedBank(null);
          }}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Choose your country...</option>
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </div>

      {/* Bank Selection */}
      {selectedCountry && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Select Your Bank</h2>
          </div>

          {banksError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load banks. Please check your credentials.</span>
            </div>
          )}

          <BankSelector
            institutions={institutions}
            isLoading={isLoadingBanks}
            onSelect={handleBankSelect}
            selectedId={selectedBank?.id}
          />
        </div>
      )}

      {/* Selected Bank & Connect */}
      {selectedBank && (
        <div className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Connect to {selectedBank.name}</h2>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-md bg-muted/50">
            {selectedBank.logo ? (
              <img
                src={selectedBank.logo}
                alt={selectedBank.name}
                className="w-12 h-12 rounded-md object-contain"
              />
            ) : (
              <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold">{selectedBank.name}</h3>
              <p className="text-sm text-muted-foreground">
                {selectedBank.bic && `BIC: ${selectedBank.bic}`}
                {selectedBank.transactionTotalDays &&
                  ` • Up to ${selectedBank.transactionTotalDays} days of history`}
              </p>
            </div>
          </div>

          {connectionStep === 'redirect' && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ExternalLink className="h-5 w-5" />
              <span>
                A new window has opened for bank authentication. Complete the process
                there, then return here.
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LinkIcon className="h-4 w-4" />
              )}
              {connectionStep === 'connecting'
                ? 'Creating connection...'
                : connectionStep === 'redirect'
                ? 'Waiting for authorization...'
                : 'Connect Bank'}
            </button>

            {selectedBank && (
              <button
                onClick={() => setSelectedBank(null)}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancel
              </button>
            )}
          </div>

          {connectMutation.error && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <span>{connectMutation.error.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Sandbox Mode Note */}
      <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">Testing Mode</p>
        <p>
          For testing, search for "Sandbox" in any country to use the GoCardless test
          bank (SANDBOXFINANCE_SFIN0000).
        </p>
      </div>
    </div>
  );
}

export default BanksPage;

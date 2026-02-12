import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GoCardlessClient } from '../api/gocardless-client';
import type { BankAccount } from '../types/gocardless';

interface UseBankConnectionOptions {
  client: GoCardlessClient;
}

export function useBankConnection({ client }: UseBankConnectionOptions) {
  const queryClient = useQueryClient();
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  // Fetch institutions for selected country
  const {
    data: institutions,
    isLoading: isLoadingInstitutions,
    error: institutionsError,
  } = useQuery({
    queryKey: ['gocardless', 'institutions', selectedCountry],
    queryFn: () => client.getInstitutions(selectedCountry),
    enabled: !!selectedCountry,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Get stored requisitions
  const { data: requisitions } = useQuery({
    queryKey: ['gocardless', 'requisitions'],
    queryFn: () => client.getStoredRequisitions(),
  });

  // Create requisition (initiate bank connection)
  const createRequisitionMutation = useMutation({
    mutationFn: async ({
      institutionId,
      redirectUrl,
    }: {
      institutionId: string;
      redirectUrl: string;
    }) => {
      // Create an agreement first
      const agreement = await client.createAgreement(institutionId, 730, 90);

      // Create the requisition
      const requisition = await client.createRequisition(
        institutionId,
        redirectUrl,
        `wealthfolio-${Date.now()}`,
        agreement.id
      );

      return requisition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'requisitions'] });
    },
  });

  // Check requisition status and fetch accounts
  const checkRequisitionMutation = useMutation({
    mutationFn: async (requisitionId: string) => {
      const requisition = await client.getRequisition(requisitionId);

      if (requisition.status === 'LN' && requisition.accounts.length > 0) {
        // Fetch and store account details for each linked account
        const accounts: BankAccount[] = [];

        for (const accountId of requisition.accounts) {
          const metadata = await client.getAccountMetadata(accountId);
          const details = await client.getAccountDetails(accountId);

          const account: BankAccount = {
            ...metadata,
            iban: details.iban || '',
            ownerName: details.ownerName || '',
          };

          await client.saveLinkedAccount(account);
          accounts.push(account);
        }

        return { requisition, accounts };
      }

      return { requisition, accounts: [] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'accounts'] });
    },
  });

  const initiateConnection = useCallback(
    async (institutionId: string, redirectUrl: string) => {
      const requisition = await createRequisitionMutation.mutateAsync({
        institutionId,
        redirectUrl,
      });
      return requisition;
    },
    [createRequisitionMutation]
  );

  const checkConnection = useCallback(
    async (requisitionId: string) => {
      return checkRequisitionMutation.mutateAsync(requisitionId);
    },
    [checkRequisitionMutation]
  );

  return {
    // Country selection
    selectedCountry,
    setSelectedCountry,

    // Institutions
    institutions: institutions ?? [],
    isLoadingInstitutions,
    institutionsError: institutionsError?.message ?? null,

    // Requisitions
    requisitions: requisitions ?? {},

    // Connection actions
    initiateConnection,
    isInitiating: createRequisitionMutation.isPending,
    initiateError: createRequisitionMutation.error?.message ?? null,

    checkConnection,
    isChecking: checkRequisitionMutation.isPending,
    checkError: checkRequisitionMutation.error?.message ?? null,
    checkResult: checkRequisitionMutation.data,
  };
}

// Common European country codes
export const SUPPORTED_COUNTRIES = [
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
] as const;

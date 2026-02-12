import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoCardlessClient } from '../api/gocardless-client';
import type { GoCardlessCredentials } from '../types/gocardless';

interface UseGoCardlessAuthOptions {
  client: GoCardlessClient;
}

export function useGoCardlessAuth({ client }: UseGoCardlessAuthOptions) {
  const queryClient = useQueryClient();

  // Check if credentials are configured
  const {
    data: isConfigured,
    isLoading: isCheckingConfig,
    refetch: recheckConfig,
  } = useQuery({
    queryKey: ['gocardless', 'auth', 'configured'],
    queryFn: () => client.hasCredentials(),
    staleTime: Infinity,
  });

  // Save credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async (credentials: GoCardlessCredentials) => {
      await client.saveCredentials(credentials);
      // Test the credentials by getting a token
      await client.getAccessToken();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless', 'auth'] });
    },
  });

  // Delete credentials mutation
  const deleteCredentialsMutation = useMutation({
    mutationFn: () => client.deleteCredentials(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gocardless'] });
    },
  });

  // Test credentials
  const testCredentialsMutation = useMutation({
    mutationFn: async () => {
      await client.getAccessToken();
      return true;
    },
  });

  const saveCredentials = useCallback(
    async (credentials: GoCardlessCredentials) => {
      return saveCredentialsMutation.mutateAsync(credentials);
    },
    [saveCredentialsMutation]
  );

  const deleteCredentials = useCallback(async () => {
    return deleteCredentialsMutation.mutateAsync();
  }, [deleteCredentialsMutation]);

  const testCredentials = useCallback(async () => {
    return testCredentialsMutation.mutateAsync();
  }, [testCredentialsMutation]);

  return {
    isConfigured: isConfigured ?? false,
    isLoading: isCheckingConfig,
    isSaving: saveCredentialsMutation.isPending,
    isDeleting: deleteCredentialsMutation.isPending,
    isTesting: testCredentialsMutation.isPending,
    saveError: saveCredentialsMutation.error?.message ?? null,
    testError: testCredentialsMutation.error?.message ?? null,
    testSuccess: testCredentialsMutation.isSuccess,
    saveCredentials,
    deleteCredentials,
    testCredentials,
    recheckConfig,
  };
}

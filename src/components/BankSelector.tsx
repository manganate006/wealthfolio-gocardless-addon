import { useState, useMemo } from 'react';
import { Building2, Search, ExternalLink, Loader2 } from 'lucide-react';
import type { Institution } from '../types/gocardless';

interface BankSelectorProps {
  institutions: Institution[];
  isLoading: boolean;
  onSelect: (institution: Institution) => void;
  selectedId?: string;
}

export function BankSelector({
  institutions,
  isLoading,
  onSelect,
  selectedId,
}: BankSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInstitutions = useMemo(() => {
    if (!searchQuery.trim()) return institutions;

    const query = searchQuery.toLowerCase();
    return institutions.filter(
      (inst) =>
        inst.name.toLowerCase().includes(query) ||
        inst.bic?.toLowerCase().includes(query)
    );
  }, [institutions, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading banks...</span>
      </div>
    );
  }

  if (institutions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Select a country to view available banks
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search banks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredInstitutions.length} bank{filteredInstitutions.length !== 1 ? 's' : ''} found
      </p>

      {/* Bank list */}
      <div className="grid gap-2 max-h-96 overflow-y-auto">
        {filteredInstitutions.map((institution) => (
          <BankCard
            key={institution.id}
            institution={institution}
            isSelected={institution.id === selectedId}
            onSelect={() => onSelect(institution)}
          />
        ))}
      </div>

      {filteredInstitutions.length === 0 && searchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          No banks found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}

interface BankCardProps {
  institution: Institution;
  isSelected: boolean;
  onSelect: () => void;
}

function BankCard({ institution, isSelected, onSelect }: BankCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`
        w-full flex items-center gap-4 p-4 rounded-lg border text-left
        transition-colors hover:bg-accent
        ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}
      `}
    >
      {/* Bank logo */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {institution.logo ? (
          <img
            src={institution.logo}
            alt={institution.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <Building2 className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {/* Bank info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{institution.name}</h3>
        <p className="text-sm text-muted-foreground">
          {institution.bic && <span>{institution.bic}</span>}
          {institution.transactionTotalDays && (
            <span className="ml-2">• Up to {institution.transactionTotalDays} days history</span>
          )}
        </p>
      </div>

      {/* Connect indicator */}
      <div className="flex-shrink-0">
        <ExternalLink className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

export default BankSelector;

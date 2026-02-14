// Wealthfolio SDK Types (simplified for addon use)

export interface AddonContext {
  api: HostAPI;
  sidebar: SidebarAPI;
  router: RouterAPI;
  onDisable: (callback: () => void) => void;
}

export interface HostAPI {
  accounts: AccountsAPI;
  activities: ActivitiesAPI;
  secrets: SecretsAPI;
  logger: LoggerAPI;
  navigation: NavigationAPI;
  query: QueryAPI;
  http: HttpAPI;
}

export interface HttpProxyRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface HttpAPI {
  /** Proxy HTTP requests through backend to bypass CORS */
  proxy(request: HttpProxyRequest): Promise<HttpProxyResponse>;
}

export interface AccountsAPI {
  getAll(): Promise<Account[]>;
}

export interface ActivitiesAPI {
  search(
    page: number,
    pageSize: number,
    filters?: ActivityFilters,
    searchKeyword?: string,
    sort?: ActivitySort
  ): Promise<ActivitySearchResult>;
  import(activities: ActivityImport[]): Promise<void>;
  checkImport(accountId: string, activities: ActivityImport[]): Promise<ImportValidation>;
  saveMany(activities: ActivityImport[]): Promise<void>;
}

export interface SecretsAPI {
  set(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export interface LoggerAPI {
  error(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  debug(message: string): void;
  trace(message: string): void;
}

export interface NavigationAPI {
  navigate(route: string): void;
}

export interface QueryAPI {
  getClient(): unknown;
  invalidateQueries(queryKey: string[]): Promise<void>;
  refetchQueries(queryKey: string[]): Promise<void>;
}

export interface SidebarAPI {
  addItem(item: SidebarItem): SidebarItemHandle;
}

export interface RouterAPI {
  add(route: RouteConfig): void;
}

export interface SidebarItem {
  id: string;
  label: string;
  route: string;
  icon?: React.ReactNode;
  order?: number;
}

export interface SidebarItemHandle {
  remove(): void;
}

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
}

// Data types
export interface Account {
  id: string;
  name: string;
  accountType: string;
  group?: string;
  currency: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalValue?: number;
}

export interface Activity {
  id: string;
  accountId: string;
  activityType: ActivityType;
  activityDate: string;
  symbol?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  fee?: number;
  isDraft: boolean;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | 'BUY'
  | 'SELL'
  | 'DIVIDEND'
  | 'INTEREST'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'FEE'
  | 'TAX'
  | 'SPLIT'
  | 'CONVERSION_IN'
  | 'CONVERSION_OUT';

export interface ActivityImport {
  accountId: string;
  activityType: ActivityType;
  date: string;
  symbol: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  fee: number;
  amount?: number;
  comment?: string;
  isDraft: boolean;
  isValid: boolean;
}

export interface ActivityFilters {
  accountIds?: string[];
  activityTypes?: ActivityType[];
  startDate?: string;
  endDate?: string;
}

export interface ActivitySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ActivitySearchResult {
  activities: Activity[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ImportValidation {
  valid: boolean;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
}

<div align="center">

# 🏦 Wealthfolio GoCardless Bank Sync

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)]()
[![React](https://img.shields.io/badge/React-19-61dafb.svg)]()
[![Wealthfolio SDK](https://img.shields.io/badge/SDK-2.0.0-purple.svg)]()

**Synchronize your bank accounts and transactions via GoCardless Open Banking API**

[English](#english) | [Français](#français)

</div>

---

## English

### Features

- 🔗 **Bank Connection** - Connect to 2,500+ European banks via GoCardless
- 📊 **Transaction Sync** - Automatic import of transactions into Wealthfolio
- 🔐 **Secure** - API credentials stored encrypted via Wealthfolio secrets
- 🗺️ **Account Mapping** - Map bank accounts to Wealthfolio accounts
- ⚡ **Real-time** - Quick sync with rate limiting support

### Installation

#### Prerequisites
- Wealthfolio v1.x with addon support
- GoCardless Bank Account Data API credentials ([Get them here](https://gocardless.com/bank-account-data/))

#### Quick Start
1. Download `gocardless-bank-sync.zip` from releases
2. In Wealthfolio: Settings → Addons → Install from ZIP
3. Enable the addon
4. Configure your GoCardless credentials in the addon settings

### Directory Structure

```
src/
├── addon.tsx              # Main entry point
├── api/
│   └── gocardless-client.ts   # GoCardless API client
├── pages/
│   ├── SettingsPage.tsx   # Credentials configuration
│   ├── BanksPage.tsx      # Bank/institution selection
│   ├── AccountsPage.tsx   # Linked accounts management
│   └── SyncPage.tsx       # Transaction synchronization
├── hooks/                 # React Query hooks
├── types/                 # TypeScript definitions
└── utils/                 # Helper utilities
```

### Required Wealthfolio Changes

⚠️ **Important**: This addon requires HTTP proxy support in Wealthfolio backend.

[See detailed changes below](#required-wealthfolio-modifications)

### Development

```bash
# Install dependencies
pnpm install

# Development with watch
pnpm dev

# Build for production
pnpm build

# Create distribution ZIP
pnpm bundle
```

---

## Français

### Fonctionnalités

- 🔗 **Connexion bancaire** - Connectez plus de 2 500 banques européennes via GoCardless
- 📊 **Sync transactions** - Import automatique des transactions dans Wealthfolio
- 🔐 **Sécurisé** - Identifiants API stockés chiffrés via les secrets Wealthfolio
- 🗺️ **Mapping comptes** - Associez vos comptes bancaires aux comptes Wealthfolio
- ⚡ **Temps réel** - Synchronisation rapide avec gestion du rate limiting

### Installation

#### Prérequis
- Wealthfolio v1.x avec support des addons
- Identifiants API GoCardless Bank Account Data ([Obtenir ici](https://gocardless.com/bank-account-data/))

#### Démarrage rapide
1. Téléchargez `gocardless-bank-sync.zip` depuis les releases
2. Dans Wealthfolio : Paramètres → Addons → Installer depuis ZIP
3. Activez l'addon
4. Configurez vos identifiants GoCardless dans les paramètres de l'addon

### Modifications Wealthfolio requises

⚠️ **Important** : Cet addon nécessite le support du proxy HTTP dans le backend Wealthfolio.

[Voir les modifications détaillées ci-dessous](#required-wealthfolio-modifications)

### Développement

```bash
# Installer les dépendances
pnpm install

# Développement avec watch
pnpm dev

# Build production
pnpm build

# Créer le ZIP de distribution
pnpm bundle
```

---

## Required Wealthfolio Modifications

This addon uses `ctx.api.http.proxy()` to bypass CORS restrictions when calling external APIs. The following changes are required in the Wealthfolio project:

### 1. Backend (Rust) - `src-server/src/api/addons.rs`

Add HTTP proxy endpoint:

```rust
// === HTTP Proxy for addons ===

#[derive(serde::Deserialize)]
struct HttpProxyBody {
    url: String,
    method: String,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<String>,
}

#[derive(serde::Serialize)]
struct HttpProxyResponse {
    status: u16,
    headers: std::collections::HashMap<String, String>,
    body: String,
}

async fn addon_http_proxy_web(
    Json(req): Json<HttpProxyBody>,
) -> ApiResult<Json<HttpProxyResponse>> {
    let client = reqwest::Client::new();
    let method = req.method.parse::<reqwest::Method>()
        .map_err(|_| anyhow::anyhow!("Invalid HTTP method: {}", req.method))?;

    let mut request = client.request(method, &req.url);

    if let Some(headers) = req.headers {
        for (key, value) in headers {
            request = request.header(&key, &value);
        }
    }

    if let Some(body) = req.body {
        request = request.body(body);
    }

    let response = request.send().await
        .map_err(|e| anyhow::anyhow!("HTTP proxy request failed: {}", e))?;

    let status = response.status().as_u16();
    let headers: std::collections::HashMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|val| (k.to_string(), val.to_string())))
        .collect();
    let body = response.text().await
        .map_err(|e| anyhow::anyhow!("Failed to read proxy response: {}", e))?;

    Ok(Json(HttpProxyResponse { status, headers, body }))
}

// Add route in router():
.route("/addons/http-proxy", post(addon_http_proxy_web))
```

### 2. Frontend - `src/adapters/web.ts`

Add command mapping:

```typescript
// In COMMANDS object:
addon_http_proxy: { method: "POST", path: "/addons/http-proxy" },

// In switch statement:
case "addon_http_proxy": {
  body = JSON.stringify(payload);
  break;
}
```

### 3. SDK - `packages/addon-sdk/src/host-api.ts`

Add TypeScript interfaces:

```typescript
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
  proxy(request: HttpProxyRequest): Promise<HttpProxyResponse>;
}

// Add to HostAPI interface:
http: HttpAPI;
```

### 4. Runtime - `src/addons/addons-runtime-context.ts`

Add implementation:

```typescript
import { addonHttpProxy } from "@/commands/addon";

// In createAddonContext():
http: {
  proxy: addonHttpProxy,
},
```

### 5. Command - `src/commands/addon.ts`

Add command implementation:

```typescript
import type { HttpProxyRequest, HttpProxyResponse } from "@anthropic/addon-sdk";

export async function addonHttpProxy(
  request: HttpProxyRequest
): Promise<HttpProxyResponse> {
  if (isDesktop()) {
    return invokeTauri("addon_http_proxy", request);
  }
  return invokeWeb("addon_http_proxy", request);
}
```

---

## API Usage Example

```typescript
// In addon code
const response = await ctx.api.http.proxy({
  url: 'https://bankaccountdata.gocardless.com/api/v2/token/new/',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ secret_id: '...', secret_key: '...' }),
});

if (response.status === 200) {
  const data = JSON.parse(response.body);
  // Process data...
}
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ for the Wealthfolio community
</div>

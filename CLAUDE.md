# Instructions de développement - GoCardless Bank Sync Addon

## Déploiement en production (LXC 136)

### Serveur cible
- **IP** : 192.168.1.186
- **Chemin addon** : `/opt/wealthfolio_data/addons/gocardless-bank/`
- **Service** : `wealthfolio.service`

### Commandes de déploiement

```bash
# 1. Build de l'addon
cd /mnt/GIT/wealthfolio-gocardless-addon
pnpm run build

# 2. Copier les fichiers sur le LXC
scp dist/addon.js root@192.168.1.186:/opt/wealthfolio_data/addons/gocardless-bank/
scp manifest.json root@192.168.1.186:/opt/wealthfolio_data/addons/gocardless-bank/

# 3. Redémarrer le service
ssh root@192.168.1.186 "systemctl restart wealthfolio.service"
```

### Commande tout-en-un

```bash
cd /mnt/GIT/wealthfolio-gocardless-addon && \
pnpm run build && \
scp dist/addon.js manifest.json root@192.168.1.186:/opt/wealthfolio_data/addons/gocardless-bank/ && \
ssh root@192.168.1.186 "systemctl restart wealthfolio.service"
```

### Vérification des logs

```bash
# Logs en temps réel
ssh root@192.168.1.186 "journalctl -u wealthfolio.service -f"

# Derniers logs
ssh root@192.168.1.186 "journalctl -u wealthfolio.service --since '5 minutes ago' -n 50"
```

## Structure des fichiers de l'addon

```
dist/
├── addon.js        # Code JavaScript bundlé (à déployer)

manifest.json       # Métadonnées de l'addon (à déployer)

src/
├── addon.tsx       # Point d'entrée principal
├── api/
│   └── gocardless-client.ts   # Client API GoCardless
├── pages/
│   ├── SettingsPage.tsx       # Configuration credentials
│   ├── BanksPage.tsx          # Sélection institution bancaire
│   ├── AccountsPage.tsx       # Gestion comptes liés
│   ├── SyncPage.tsx           # Synchronisation transactions
│   └── DiagnosticPage.tsx     # Page de diagnostic
├── hooks/                      # React Query hooks
├── types/                      # Définitions TypeScript
└── utils/                      # Utilitaires
```

## Format du manifest.json

**IMPORTANT** : Les permissions doivent utiliser des objets `FunctionPermission`, pas de simples chaînes :

```json
{
  "permissions": [
    {
      "category": "secrets",
      "functions": [
        { "name": "get", "isDeclared": true, "isDetected": false },
        { "name": "set", "isDeclared": true, "isDetected": false }
      ],
      "purpose": "Description de l'usage"
    }
  ]
}
```

## Secrets utilisés par l'addon

| Clé | Description |
|-----|-------------|
| `gocardless_credentials` | Secret ID et Secret Key de l'API |
| `gocardless_tokens` | Access token et refresh token |
| `gocardless_requisitions` | Requisitions stockées (connexions bancaires) |
| `gocardless_linked_accounts` | Comptes bancaires liés |
| `gocardless_last_sync_{accountId}` | Date de dernière sync par compte |

## Diagnostic des problèmes

### Les comptes ne s'affichent pas
1. Aller sur la page **Diagnostic** (icône bug)
2. Vérifier le statut des requisitions (doit être "LN" = Linked)
3. Si requisition valide mais pas de comptes liés → cliquer "Re-link Accounts"

### Erreur 500 sur l'API addons
- Vérifier le format du manifest.json (permissions en objets, pas en chaînes)
- Vérifier les logs : `journalctl -u wealthfolio.service -n 100`

### L'addon ne charge pas
- Vérifier que `enabled: true` dans manifest.json
- Vérifier que addon.js existe et n'est pas vide
- Redémarrer le service Wealthfolio

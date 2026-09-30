# Module Pige (collecte d'annonces de particuliers)

Collecte automatique d'annonces immobilières de **particuliers** (Leboncoin + SeLoger)
stockées dans MySQL, consultables via l'API admin.

**Deux modes de collecte possibles :**

1. **Via n8n (recommandé si tu as déjà une instance)** — le workflow lance les
   actors Apify et pousse les résultats vers `POST /api/pige/ingest`.
   Importer `pige-n8n-workflow.json` dans n8n (Workflows → Import from File).
2. **Via le cron interne** — le module `src/pige/cron.js` lance directement les
   actors depuis l'API (aucune config n8n). Activé par défaut (`PIGE_CRON=true`).

## Coûts Apify (tarifs Store constatés, plan gratuit)

| Ce qui est facturé | Prix |
|---|---|
| Annonce Leboncoin scrapée | 1,49 $ / 1000 (0,99 $ sur plan payant Apify) |
| Numéro de téléphone trouvé | 9,99 $ / 1000 (introuvables non facturés) |
| Annonce SeLoger (actor léxis) | ~0,5 $ / 1000 selon événements du run |
| Annonces sans téléphone | ~1,50 € / 1000 |

⚠️ Avec téléphones : ~11 € / 1000 annonces. Sans : ~1,50 € / 1000.
Les runs planifiés sans nouvelle annonce ne raclent que les nouveautés → coût très faible en régime croisière.

## Configuration

Dans `packages/api/.env` :

```ini
APIFY_TOKEN="..."        # console.apify.com → Settings → API & Integrations
LBC_EMAIL="..."          # compte leboncoin.fr gratuit, requis pour les téléphones
LBC_PASSWORD="..."       # chiffré par l'actor, jamais stocké en clair
PIGE_CRON="true"         # false = désactive l'auto-collecte 5x/jour
```

Puis :

```bash
cd packages/api
npx prisma migrate dev   # crée les tables pige_*
npm run dev
```

## Utilisation (routes admin, JWT requis)

```bash
# 1. Créer une recherche (critères = format input de l'actor Apify)
curl -X POST http://localhost:4000/api/admin/pige/recherches \
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{
    "nom": "Saint-Julien ventes",
    "source": "leboncoin",
    "apifyInput": {
      "immobilierCategory": "9",
      "location": "Saint-Julien-en-Genevois 74160",
      "seller_type": "private",
      "adLimit": 200
    }
  }'

# 2. Lancer maintenant (attend la fin du run Apify, ~1-2 min)
curl -X POST .../api/admin/pige/recherches/1/run

# 3. Lister les annonces (filtres : cp, ville, trans=V|L, typeBien, prixMin/Max,
#    surfMin/Max, dpe, nouveau=1, q=mot-clé, page, perPage)
curl ".../api/admin/pige/annonces?cp=74&trans=V&prixMax=400000&avec_tel=1"

# 4. Stats & coût
curl ".../api/admin/pige/stats"
curl ".../api/admin/pige/runs"
```

## Cron automatique (mode sans n8n)

5 runs/jour (7h00, 10h30, 13h30, 17h00, 20h30) sur toutes les recherches `active: true`.
Séquentiels (compat plan gratuit Apify = 1 run simultané). Désactivable avec `PIGE_CRON=false`.

## Mode n8n (recommandé)

1. Sur le VPS, ajoute au `.env` de l'API :
   `PIGE_INGEST_SECRET="un-long-secret-aleatoire"` + `pm2 restart immo-api`
2. Dans n8n : **Workflows → Import from File** → `pige-n8n-workflow.json`
3. Dans le workflow :
   - Remplace `https://TON-DOMAINE` par ton domaine dans le node "Envoyer à l'API Immo-App"
   - Crée 2 credentials "Header Auth" ou mets le token Apify en query param
   - Le secret n8n ("X-Ingest-Secret") = la valeur de `PIGE_INGEST_SECRET`
4. Teste avec "Execute Workflow" puis vérifie dans ton admin : les annonces arrivent.

Le node final POST ce payload (l'API filtre les particuliers et dédoublonne) :

```json
{ "source": "leboncoin", "items": [ { ...annonce_apify_brute... } ] }
```

Réponse: `{ "ok": true, "nouveaux": 12, "maj": 3, "telephones": 8 }`

## Dédoublonnage

1. `UNIQUE(source, url)` — même annonce re-scannée = mise à jour, pas de recharge.
2. `fingerprint` (type + CP + ville + surface ±3 m² + prix ±2 %) — même bien **reposté**
   sous une nouvelle URL Leboncoin regroupé via ce champ.
3. Changement de prix → ajout dans `PigeHistoriquePrix` (baisses de prix = opportunité).

## Sources / actors

| Source | Actor | Remarques |
|---|---|---|
| Leboncoin | `clearpath/leboncoin-immobilier` | téléphones via compte LBC (2FA possible : relancer avec `twoFactorCode`) |
| SeLoger | `lexis-solutions/seloger-scraper` | mapper `mapSeloger()` à ajuster au 1er run — inspecter un item du dataset |

Inspecter la sortie réelle d'un actor pour ajuster le mapping :

```bash
curl ".../api/admin/pige/annonces?perPage=1"   # après un run, vérifier les champs
```

## Limites connues

- **Adresse exacte** : Leboncoin n'expose que CP/ville + position approximative.
  (DirectMandat enrichit via cadastre/BAN — futur module, API BAN gratuite.)
- **Bloctel** : nécessite un abonnement Opposetel — non inclus. `telStatut` reflète
  seulement la disponibilité du numéro côté annonce.
- Les acteurs Apify peuvent être mis à jour par leurs devs : si les champs changent,
  corriger `mapLeboncoin()` / `mapSeloger()` dans `src/pige/ingest.js`.
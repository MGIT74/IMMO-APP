# Immo App

Application de gestion de biens immobiliers (successeur du plugin WordPress), en 3 parties :

- **packages/web** — Site public (Astro, mode SSR) : liste des biens, fiche détaillée, formulaire de demande, bouton "j'aime".
- **packages/admin** — Interface d'administration (React + Vite) : CRM des biens, demandes reçues, réglages (taux d'honoraires).
- **packages/api** — API (Node + Express + Prisma + MySQL) : sert les deux interfaces ci-dessus.

## Prérequis

- Node.js 20+
- Une base MySQL accessible (locale ou sur le VPS)

## Installation

```bash
npm install
```

### 1. Configurer l'API

```bash
cd packages/api
cp .env.example .env
# Éditez .env : DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
npx prisma migrate dev --name init   # crée les tables dans MySQL
npm run db:seed                       # crée votre compte admin
cd ../..
```

### 2. Configurer le site public et l'admin

```bash
cp packages/web/.env.example packages/web/.env
cp packages/admin/.env.example packages/admin/.env
```

### 3. Lancer en développement (3 terminaux, ou en arrière-plan)

```bash
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:4321  (site public)
npm run dev:admin   # http://localhost:5173  (administration)
```

Connectez-vous sur l'admin avec l'email/mot de passe défini dans `packages/api/.env`.

## Déploiement sur un VPS (aperçu)

1. `git clone` ce dépôt sur le VPS, `npm install` à la racine.
2. MySQL installé sur le VPS, base créée, `.env` de l'API rempli avec les vraies valeurs.
3. `npm run db:migrate` puis `npm run db:seed` (une seule fois).
4. Builder le site et l'admin :
   ```bash
   npm run build --workspace=packages/web    # build/ Astro (mode standalone)
   npm run build --workspace=packages/admin  # dist/ (fichiers statiques)
   ```
5. **PM2** pour garder l'API et le serveur Astro actifs :
   ```bash
   pm2 start packages/api/src/index.js --name immo-api
   pm2 start packages/web/dist/server/entry.mjs --name immo-web
   pm2 save
   ```
6. **Nginx** en façade : reverse proxy vers l'API (`/api`, `/uploads`) et vers Astro (le reste du site public), et sert les fichiers statiques du dossier `packages/admin/dist` sur un sous-domaine ou un chemin dédié (ex. `admin.votredomaine.com`). Certbot pour le HTTPS.

## Ce qui est prêt

- Schéma de base de données complet (biens, photos, équipements, demandes, likes, réglages)
- API : authentification, CRUD des biens (avec équipements imbriqués), demandes, likes, réglages, upload/suppression/réordonnancement de photos (redimensionnement automatique)
- Site public : liste des biens, fiche détaillée avec **carrousel photo** et **badge d'état animé** (clignote/onde), formulaire de demande, bouton like
- Admin : connexion, **Vue CRM** (créer/modifier/supprimer un bien, marquer vendu/masquer en un clic), **formulaire d'édition complet** (état, équipements avec génération automatique du texte, photos avec réordonnancement), **Tableau de bord** (statistiques, répartition par état, dernières demandes), liste des demandes, réglages du taux d'honoraires (général + personnalisé par bien)

## Prochaines étapes suggérées

- Publication automatique Instagram / Facebook (module à part, nécessite OAuth Meta + tâches planifiées)
- Slider en boucle infinie sur la page d'accueil (grille de biens), comme sur le plugin WordPress
- Export CSV des demandes
- Filtres (ville, type, prix) sur la liste publique des biens


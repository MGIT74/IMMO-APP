import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// Mode SSR (pas de génération statique) : chaque visite va chercher les
// biens à jour auprès de l'API, pour refléter immédiatement les changements
// faits depuis le CRM (bien vendu, masqué, prix modifié...).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321 },
});

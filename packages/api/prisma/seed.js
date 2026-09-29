import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans votre .env avant de lancer le seed.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  // Taux d'honoraires par défaut si absent.
  await prisma.setting.upsert({
    where: { key: 'taux_honoraires' },
    update: {},
    create: { key: 'taux_honoraires', value: '5' },
  });

  // Deux biens fictifs de démonstration, créés une seule fois (si la base est vide).
  const bienCount = await prisma.bien.count();
  if (bienCount === 0) {
    await prisma.bien.create({
      data: {
        titre: 'Résidence Les Tilleuls',
        type: 'Appartement',
        prix: 285000,
        ville: 'Annemasse',
        codePostal: '74100',
        surface: 68,
        pieces: 3,
        chambres: 2,
        etatTexte: 'Livrée',
        etatCouleur: '#43a047',
        etatAnim: 'none',
        publie: true,
        luxe: false,
        photos: {
          create: [{ url: 'https://picsum.photos/seed/tilleuls-immo/1200/900', ordre: 0 }],
        },
        equipements: {
          create: [
            { icone: 'salle_bain', texte: '1 Salle de bain', ordre: 0 },
            { icone: 'toilettes', texte: '1 Toilettes', ordre: 1 },
            { icone: 'balcon', texte: '1 Balcon', ordre: 2 },
          ],
        },
      },
    });

    await prisma.bien.create({
      data: {
        titre: 'Villa Belvédère',
        type: 'Maison',
        prix: 1250000,
        ville: 'Saint-Julien-en-Genevois',
        codePostal: '74160',
        surface: 320,
        pieces: 8,
        chambres: 5,
        etatTexte: 'Disponible',
        etatCouleur: '#d4af37',
        etatAnim: 'pulse',
        livraison: 'Livraison T2 2026',
        luxe: true,
        description:
          "Une villa d'exception surplombant le lac, alliant architecture contemporaine et matériaux nobles pour une vie hors du commun.",
        publie: true,
        photos: {
          create: [
            { url: 'https://picsum.photos/seed/belvedere-immo-1/1600/1000', ordre: 0 },
            { url: 'https://picsum.photos/seed/belvedere-immo-2/1600/1000', ordre: 1 },
          ],
        },
        equipements: {
          create: [
            { icone: 'piscine', texte: 'Piscine', ordre: 0 },
            { icone: 'garage', texte: '2 Garage', ordre: 1 },
            { icone: 'jardin', texte: 'Jardin', ordre: 2 },
          ],
        },
      },
    });

    console.log('2 biens fictifs créés (démo) : Résidence Les Tilleuls + Villa Belvédère.');
  }

  console.log(`Compte admin prêt : ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

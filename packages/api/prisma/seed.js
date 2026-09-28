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

  console.log(`Compte admin prêt : ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

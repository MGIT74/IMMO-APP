import { PrismaClient } from '@prisma/client';

// Un seul client Prisma pour toute l'appli (évite d'ouvrir trop de connexions).
export const prisma = new PrismaClient();

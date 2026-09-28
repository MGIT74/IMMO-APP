import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const UPLOADS_DIR = path.resolve('uploads');

// Envoie une photo pour un bien donné : POST /api/admin/uploads/:bienId  (champ "photo")
uploadsRouter.post('/:bienId', upload.single('photo'), async (req, res) => {
  const bienId = Number(req.params.bienId);
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

  const bienDir = path.join(UPLOADS_DIR, `bien-${bienId}`);
  await fs.mkdir(bienDir, { recursive: true });

  const filename = `${Date.now()}.webp`;
  const filePath = path.join(bienDir, filename);

  // Redimensionne à une largeur raisonnable et convertit en webp (léger, bonne qualité).
  await sharp(req.file.buffer)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(filePath);

  const lastPhoto = await prisma.photo.findFirst({
    where: { bienId },
    orderBy: { ordre: 'desc' },
  });

  const photo = await prisma.photo.create({
    data: {
      bienId,
      url: `/uploads/bien-${bienId}/${filename}`,
      ordre: lastPhoto ? lastPhoto.ordre + 1 : 0,
    },
  });

  res.status(201).json(photo);
});

uploadsRouter.delete('/:photoId', async (req, res) => {
  const photo = await prisma.photo.findUnique({ where: { id: Number(req.params.photoId) } });
  if (!photo) return res.status(404).json({ error: 'Photo introuvable.' });

  const filePath = path.join(process.cwd(), photo.url);
  await fs.unlink(filePath).catch(() => {}); // on ignore si le fichier n'existe déjà plus

  await prisma.photo.delete({ where: { id: photo.id } });
  res.status(204).end();
});

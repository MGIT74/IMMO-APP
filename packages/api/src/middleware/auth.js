import jwt from 'jsonwebtoken';

/**
 * Bloque l'accès à une route si le token JWT (envoyé dans l'en-tête
 * "Authorization: Bearer ...") est absent ou invalide.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

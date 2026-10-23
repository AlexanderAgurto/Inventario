import { HttpError } from '../errors/http-error.js';

export function corsMiddleware(req, res, next) {
  const origin = req.get('Origin');
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:4200';

  res.vary('Origin');
  if (origin && origin !== allowedOrigin) {
    return next(new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'El origen de la solicitud no está permitido.'));
  }

  if (origin) {
    res.set('Access-Control-Allow-Origin', allowedOrigin);
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

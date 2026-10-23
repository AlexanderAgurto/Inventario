import { HttpError } from '../errors/http-error.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Ocurrió un error interno.';

  if (error instanceof HttpError) {
    ({ status, code, message } = error);
  } else if (error?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'El cuerpo de la solicitud no contiene JSON válido.';
  } else if (error?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'El cuerpo de la solicitud supera el tamaño permitido.';
  } else if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Los datos enviados no son válidos.';
  } else if (error?.code === 11000) {
    status = 409;
    code = 'DUPLICATE_PRODUCT';
    message = 'Ya existe un producto con ese SKU.';
  }

  if (status >= 500) console.error('Error interno de la API:', error);
  res.status(status).json({ error: { code, message } });
}

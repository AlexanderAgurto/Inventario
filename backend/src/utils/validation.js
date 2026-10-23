import mongoose from 'mongoose';
import { HttpError } from '../errors/http-error.js';

function badRequest(message) {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${label} debe ser un objeto JSON.`);
  }
}

export function parseProductInput(body) {
  assertPlainObject(body, 'El producto');

  const allowedFields = new Set(['sku', 'name', 'category', 'price', 'stock']);
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw badRequest(`Campo no permitido: ${unknownFields[0]}.`);
  }

  if (typeof body.sku !== 'string' || body.sku.trim().length === 0 || body.sku.trim().length > 64) {
    throw badRequest('sku debe ser un texto de entre 1 y 64 caracteres.');
  }
  if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.trim().length > 120) {
    throw badRequest('name debe ser un texto de entre 1 y 120 caracteres.');
  }
  if (body.category !== undefined && (typeof body.category !== 'string' || body.category.trim().length > 120)) {
    throw badRequest('category debe ser un texto de hasta 120 caracteres.');
  }
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) {
    throw badRequest('price debe ser un número finito mayor o igual a cero.');
  }
  if (body.stock !== undefined && (!Number.isSafeInteger(body.stock) || body.stock < 0)) {
    throw badRequest('stock debe ser un entero no negativo.');
  }

  return {
    sku: body.sku.trim(),
    name: body.name.trim(),
    ...(body.category !== undefined ? { category: body.category.trim() } : {}),
    price: body.price,
    ...(body.stock !== undefined ? { stock: body.stock } : {}),
  };
}

export function parseStockAdjustment(body) {
  assertPlainObject(body, 'El ajuste de stock');

  const keys = Object.keys(body);
  if (keys.some((key) => key !== 'amount' && key !== 'delta')) {
    throw badRequest('El ajuste solo admite un campo amount o delta.');
  }
  if (Object.hasOwn(body, 'amount') && Object.hasOwn(body, 'delta')) {
    throw badRequest('Envía amount o delta, pero no ambos.');
  }

  const amount = Object.hasOwn(body, 'amount') ? body.amount : body.delta;
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw badRequest('amount debe ser un entero distinto de cero.');
  }

  return amount;
}

export function buildStockAdjustmentFilter(id, amount) {
  const storedStockType = { $type: '$stock' };
  const isMissingStock = { $eq: [storedStockType, 'missing'] };
  const isNumericStock = {
    $in: [storedStockType, ['int', 'long', 'double', 'decimal']],
  };
  const currentStockIsValid = {
    $cond: [
      isMissingStock,
      true,
      {
        $cond: [
          isNumericStock,
          {
            $and: [
              { $eq: [{ $mod: ['$stock', 1] }, 0] },
              { $gte: ['$stock', 0] },
              { $lte: ['$stock', Number.MAX_SAFE_INTEGER] },
            ],
          },
          false,
        ],
      },
    ],
  };
  // These arithmetic expressions are evaluated only after currentStockIsValid succeeds.
  const safeCurrentStock = { $cond: [isMissingStock, 0, '$stock'] };
  const resultingStock = { $add: [safeCurrentStock, amount] };
  const resultingStockIsValid = {
    $cond: [
      currentStockIsValid,
      {
        $and: [
          { $eq: [{ $mod: [resultingStock, 1] }, 0] },
          { $gte: [resultingStock, 0] },
          { $lte: [resultingStock, Number.MAX_SAFE_INTEGER] },
        ],
      },
      false,
    ],
  };

  return {
    _id: id,
    $expr: {
      $and: [currentStockIsValid, resultingStockIsValid],
    },
  };
}

export function parsePagination(query) {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const limit = parsePositiveInteger(query.limit, 10, 'limit');
  if (limit > 100) throw badRequest('limit no puede ser mayor que 100.');
  if (page > Math.floor(Number.MAX_SAFE_INTEGER / limit)) {
    throw badRequest('page está fuera del rango permitido.');
  }

  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 100)) {
    throw badRequest('search debe ser un texto de hasta 100 caracteres.');
  }

  return { page, limit, search: query.search?.trim() || '' };
}

function parsePositiveInteger(value, fallback, field) {
  if (value === undefined || value === '') return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw badRequest(`${field} debe ser un entero positivo.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(`${field} debe ser un entero positivo.`);
  }
  return parsed;
}

export function assertValidProductId(id) {
  if (!/^[a-f\d]{24}$/i.test(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new HttpError(400, 'INVALID_ID', 'El identificador del producto no es válido.');
  }
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

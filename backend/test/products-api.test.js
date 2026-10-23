import assert from 'node:assert/strict';
import { test } from 'node:test';
import Product from '../src/models/Product.js';
import { adjustStock, create, getById, list, remove } from '../src/controllers/products.controller.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { corsMiddleware } from '../src/middleware/cors.js';
import { HttpError } from '../src/errors/http-error.js';
import { resolveMongoUri } from '../src/config/db.js';
import { mongoStartupErrorMessage } from '../src/utils/startup-error.js';
import {
  assertValidProductId,
  buildStockAdjustmentFilter,
  escapeRegex,
  parsePagination,
  parseProductInput,
  parseStockAdjustment,
} from '../src/utils/validation.js';

const stubsByTest = new WeakMap();

function stub(t, target, key, value) {
  let targetStubs = stubsByTest.get(t);
  if (!targetStubs) {
    targetStubs = new Map();
    stubsByTest.set(t, targetStubs);
    t.after(() => {
      for (const keyStubs of [...targetStubs.values()].reverse()) {
        for (const restore of [...keyStubs.values()].reverse()) restore();
      }
    });
  }

  let keyStubs = targetStubs.get(target);
  if (!keyStubs) {
    keyStubs = new Map();
    targetStubs.set(target, keyStubs);
  }
  if (!keyStubs.has(key)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    keyStubs.set(key, () => {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else delete target[key];
    });
  }

  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

function invokeErrorHandler(error) {
  const res = responseRecorder();
  res.headersSent = false;
  errorHandler(error, {}, res, (nextError) => {
    throw nextError;
  });
  return res;
}

test('validates and normalizes product creation data', () => {
  assert.deepEqual(
    parseProductInput({ sku: ' SKU-1 ', name: ' Teclado ', category: ' Periféricos ', price: 12.5, stock: 3 }),
    { sku: 'SKU-1', name: 'Teclado', category: 'Periféricos', price: 12.5, stock: 3 }
  );
  assert.throws(() => parseProductInput({ sku: 'A', name: 'Producto', price: Infinity }), HttpError);
  assert.throws(() => parseProductInput({ sku: 'A', name: 'Producto', price: 2, stock: -1 }), HttpError);
  assert.throws(() => parseProductInput({ sku: 'A', name: 'Producto', price: 2, admin: true }), HttpError);
});

test('keeps API product constraints aligned with the Mongoose schema', () => {
  assert.equal(Product.schema.path('sku').options.required, true);
  assert.equal(Product.schema.path('sku').options.trim, true);
  assert.equal(Product.schema.path('sku').options.maxlength, 64);
  assert.equal(Product.schema.path('name').options.maxlength, 120);
  assert.equal(Product.schema.path('category').options.maxlength, 120);
  assert.equal(Product.schema.path('price').options.min, 0);
  assert.equal(Product.schema.path('price').options.validate.validator, Number.isFinite);
  assert.equal(Product.schema.path('stock').options.min, 0);
  assert.equal(Product.schema.path('stock').options.validate.validator, Number.isSafeInteger);
});

test('accepts canonical amount and legacy delta stock fields, rejects invalid quantities', () => {
  assert.equal(parseStockAdjustment({ amount: 4 }), 4);
  assert.equal(parseStockAdjustment({ delta: -2 }), -2);
  for (const body of [{}, { amount: 0 }, { amount: 1.5 }, { amount: '2' }, { amount: 1, delta: 1 }]) {
    assert.throws(() => parseStockAdjustment(body), HttpError);
  }
});

test('guards the atomic stock filter against nonnumeric and out-of-range stored stock', () => {
  const filter = buildStockAdjustmentFilter('507f1f77bcf86cd799439011', 1);
  const conditions = filter.$expr.$and;
  const currentStockIsValid = conditions[0];
  const numericTypeGuard = currentStockIsValid.$cond[2].$cond[0];
  const currentStockChecks = currentStockIsValid.$cond[2].$cond[1].$and;
  const resultingStockIsValid = conditions[1];

  assert.deepEqual(filter._id, '507f1f77bcf86cd799439011');
  assert.deepEqual(currentStockIsValid.$cond[0], {
    $eq: [{ $type: '$stock' }, 'missing'],
  });
  assert.equal(currentStockIsValid.$cond[1], true);
  assert.deepEqual(numericTypeGuard, {
    $in: [{ $type: '$stock' }, ['int', 'long', 'double', 'decimal']],
  });
  assert.equal(currentStockIsValid.$cond[2].$cond[2], false);
  assert.deepEqual(currentStockChecks, [
    { $eq: [{ $mod: ['$stock', 1] }, 0] },
    { $gte: ['$stock', 0] },
    { $lte: ['$stock', Number.MAX_SAFE_INTEGER] },
  ]);
  assert.deepEqual(resultingStockIsValid.$cond[0], currentStockIsValid);
  assert.equal(resultingStockIsValid.$cond[2], false);
  assert.deepEqual(resultingStockIsValid.$cond[1].$and, [
    { $eq: [{ $mod: [{ $add: [{ $cond: [currentStockIsValid.$cond[0], 0, '$stock'] }, 1] }, 1] }, 0] },
    { $gte: [{ $add: [{ $cond: [currentStockIsValid.$cond[0], 0, '$stock'] }, 1] }, 0] },
    { $lte: [{ $add: [{ $cond: [currentStockIsValid.$cond[0], 0, '$stock'] }, 1] }, Number.MAX_SAFE_INTEGER] },
  ]);
});

test('validates pagination and escapes search input', () => {
  assert.deepEqual(parsePagination({}), { page: 1, limit: 10, search: '' });
  assert.deepEqual(parsePagination({ page: '2', limit: '25', search: ' teclado ' }), {
    page: 2,
    limit: 25,
    search: 'teclado',
  });
  assert.throws(() => parsePagination({ page: '1abc' }), HttpError);
  assert.throws(() => parsePagination({ limit: '101' }), HttpError);
  assert.equal(escapeRegex('a.b'), 'a\\.b');
});

test('accepts only well-formed MongoDB product IDs', () => {
  assert.doesNotThrow(() => assertValidProductId('507f1f77bcf86cd799439011'));
  assert.throws(() => assertValidProductId('invalid'), (error) => error.status === 400);
});

test('uses compatible Mongo URI variable names in priority order', () => {
  assert.equal(resolveMongoUri({ MONGODB_URI: 'mongodb://primary/db', MONGO_URI: 'mongodb://legacy/db' }), 'mongodb://primary/db');
  assert.equal(resolveMongoUri({ MONGO_URI: 'mongodb://legacy/db' }), 'mongodb://legacy/db');
  assert.equal(resolveMongoUri({}), 'mongodb://127.0.0.1:27017/test');
});

test('lists the first page from offset zero with the unchanged response shape', async (t) => {
  let skipValue;
  let limitValue;
  const products = [{ sku: 'SKU-1' }];
  stub(t, Product, 'find', () => ({
    sort() { return this; },
    skip(value) { skipValue = value; return this; },
    limit(value) { limitValue = value; return Promise.resolve(products); },
  }));
  stub(t, Product, 'countDocuments', async () => 11);

  const res = responseRecorder();
  await list({ query: { page: '1', limit: '10' } }, res);

  assert.equal(skipValue, 0);
  assert.equal(limitValue, 10);
  assert.deepEqual(res.body, { data: products, page: 1, limit: 10, total: 11 });
});

test('creates only validated product fields', async (t) => {
  let createdInput;
  const product = { _id: 'id', sku: 'SKU-1' };
  stub(t, Product, 'create', async (input) => { createdInput = input; return product; });

  const res = responseRecorder();
  await assert.rejects(
    create({ body: { sku: ' SKU-1 ', name: ' Item ', price: 10, internal: 'ignored' } }, res),
    (error) => error.status === 400
  );
  assert.equal(createdInput, undefined);

  await create({ body: { sku: ' SKU-1 ', name: ' Item ', price: 10 } }, res);
  assert.deepEqual(createdInput, { sku: 'SKU-1', name: 'Item', price: 10 });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body, product);
});

test('adjusts stock atomically and returns the persisted document', async (t) => {
  let updateFilter;
  let updateOperation;
  let updateOptions;
  const product = { _id: '507f1f77bcf86cd799439011', stock: 7 };
  stub(t, Product, 'findOneAndUpdate', async (filter, update, options) => {
    updateFilter = filter;
    updateOperation = update;
    updateOptions = options;
    return product;
  });

  const res = responseRecorder();
  await adjustStock({ params: { id: product._id }, body: { amount: 2 } }, res);

  assert.deepEqual(updateFilter, buildStockAdjustmentFilter(product._id, 2));
  assert.deepEqual(updateOperation, { $inc: { stock: 2 } });
  assert.equal(updateOptions.new, true);
  assert.equal(updateOptions.runValidators, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, product);
});

test('rejects a stock adjustment below zero and distinguishes missing products', async (t) => {
  const id = '507f1f77bcf86cd799439011';
  let updateFilter;
  stub(t, Product, 'findOneAndUpdate', async (filter) => { updateFilter = filter; return null; });
  stub(t, Product, 'exists', async () => ({ _id: id }));

  await assert.rejects(
    adjustStock({ params: { id }, body: { amount: -5 } }, responseRecorder()),
    (error) => error.status === 409 && error.code === 'STOCK_CONFLICT'
  );
  assert.deepEqual(updateFilter, buildStockAdjustmentFilter(id, -5));

  stub(t, Product, 'exists', async () => null);
  await assert.rejects(
    adjustStock({ params: { id }, body: { amount: 1 } }, responseRecorder()),
    (error) => error.status === 404 && error.code === 'PRODUCT_NOT_FOUND'
  );
});

test('returns not found for missing get and delete targets', async (t) => {
  const id = '507f1f77bcf86cd799439011';
  stub(t, Product, 'findById', async () => null);
  stub(t, Product, 'findByIdAndDelete', async () => null);

  await assert.rejects(getById({ params: { id } }, responseRecorder()), (error) => error.status === 404);
  await assert.rejects(remove({ params: { id } }, responseRecorder()), (error) => error.status === 404);
});

test('returns the documented success statuses for get and delete', async (t) => {
  const id = '507f1f77bcf86cd799439011';
  const product = { _id: id, sku: 'SKU-1' };
  stub(t, Product, 'findById', async () => product);
  stub(t, Product, 'findByIdAndDelete', async () => product);

  const getResponse = responseRecorder();
  await getById({ params: { id } }, getResponse);
  assert.equal(getResponse.statusCode, 200);
  assert.equal(getResponse.body, product);

  const deleteResponse = responseRecorder();
  await remove({ params: { id } }, deleteResponse);
  assert.equal(deleteResponse.statusCode, 204);
  assert.equal(deleteResponse.body, undefined);
});

test('returns consistent client errors and hides internal error details', () => {
  const badRequest = invokeErrorHandler(new HttpError(400, 'VALIDATION_ERROR', 'Entrada inválida.'));
  assert.equal(badRequest.statusCode, 400);
  assert.deepEqual(badRequest.body, { error: { code: 'VALIDATION_ERROR', message: 'Entrada inválida.' } });

  const originalConsoleError = console.error;
  console.error = () => {};
  const internal = invokeErrorHandler(new Error('internal database error'));
  console.error = originalConsoleError;
  assert.equal(internal.statusCode, 500);
  assert.deepEqual(internal.body, { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error interno.' } });

  const duplicate = invokeErrorHandler(Object.assign(new Error('duplicate'), { code: 11000 }));
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.body.error.code, 'DUPLICATE_PRODUCT');

  const invalidJson = invokeErrorHandler(Object.assign(new Error('parser detail'), { type: 'entity.parse.failed' }));
  assert.equal(invalidJson.statusCode, 400);
  assert.equal(invalidJson.body.error.code, 'INVALID_JSON');
});

test('formats MongoDB startup errors without including the connection URI', () => {
  const error = new Error('failed to connect mongodb://user:secret@localhost:27017/inventory');
  error.name = 'MongooseServerSelectionError';
  const message = mongoStartupErrorMessage(error);

  assert.match(message, /MongooseServerSelectionError/);
  assert.match(message, /Compruebe que el servicio esté activo/);
  assert.doesNotMatch(message, /secret|mongodb:\/\//i);
});

test('allows the configured local frontend origin and rejects other origins', () => {
  const previousOrigin = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = 'http://localhost:4200';
  const makeResponse = () => {
    const values = {};
    const response = {
      values,
      vary: () => {},
      set: (key, value) => { values[key] = value; },
      sendStatus: (status) => { values.status = status; return response; },
    };
    return response;
  };
  let nextError;

  try {
    const res = makeResponse();
    corsMiddleware({ get: () => 'http://localhost:4200', method: 'GET' }, res, (error) => { nextError = error; });
    assert.equal(res.values['Access-Control-Allow-Origin'], 'http://localhost:4200');
    assert.equal(nextError, undefined);

    const preflightResponse = makeResponse();
    corsMiddleware({ get: () => 'http://localhost:4200', method: 'OPTIONS' }, preflightResponse, (error) => { nextError = error; });
    assert.equal(preflightResponse.values.status, 204);
    assert.equal(preflightResponse.values['Access-Control-Allow-Origin'], 'http://localhost:4200');
    assert.equal(preflightResponse.values['Access-Control-Allow-Methods'], 'GET, POST, PATCH, DELETE, OPTIONS');

    const rejectedResponse = makeResponse();
    corsMiddleware({ get: () => 'https://example.com', method: 'GET' }, rejectedResponse, (error) => { nextError = error; });
    assert.equal(nextError.status, 403);
    assert.equal(rejectedResponse.values['Access-Control-Allow-Origin'], undefined);

    const noOriginResponse = makeResponse();
    let passedWithoutOrigin = false;
    corsMiddleware({ get: () => undefined, method: 'GET' }, noOriginResponse, () => { passedWithoutOrigin = true; });
    assert.equal(passedWithoutOrigin, true);
    assert.equal(noOriginResponse.values['Access-Control-Allow-Origin'], undefined);
  } finally {
    if (previousOrigin === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previousOrigin;
  }
});

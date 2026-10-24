import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { test } from 'node:test';
import mongoose from 'mongoose';
import app from '../src/app.js';
import Product from '../src/models/Product.js';

const expectedDatabase = 'inventario_integration_test';

function getSafeIntegrationUri(uri) {
  if (!uri) {
    throw new Error('Define MONGODB_URI con la base local inventario_integration_test para ejecutar la integración.');
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI no es una URI MongoDB válida; no se abrió ninguna conexión.');
  }

  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  if (
    parsed.protocol !== 'mongodb:' ||
    !localHosts.has(parsed.hostname) ||
    parsed.port !== '27017' ||
    parsed.pathname !== `/${expectedDatabase}` ||
    parsed.hash
  ) {
    throw new Error(
      `La integración solo permite MongoDB local en la base ${expectedDatabase}; no se abrió ninguna conexión.`
    );
  }

  return uri;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function request(port, { method = 'GET', path, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port,
      method,
      path,
      headers: payload === undefined ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        let json;
        if (responseBody) {
          try {
            json = JSON.parse(responseBody);
          } catch (error) {
            reject(error);
            return;
          }
        }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

test('integrates product listing, creation, stock adjustment, and deletion with isolated MongoDB', async () => {
  // Validate before connecting. This suite never uses dotenv or the development URI fallback.
  const uri = getSafeIntegrationUri(process.env.MONGODB_URI);
  let server;
  let createdId;
  let createdSku;
  let creationSucceeded = false;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    assert.equal(mongoose.connection.name, expectedDatabase);

    server = app.listen(0, '127.0.0.1');
    await listen(server);
    const { port } = server.address();

    const initialList = await request(port, { path: '/api/products?page=1&limit=10' });
    assert.equal(initialList.status, 200);
    assert.ok(Array.isArray(initialList.body.data));
    assert.equal(initialList.body.page, 1);
    assert.equal(initialList.body.limit, 10);
    assert.ok(Number.isInteger(initialList.body.total));
    assert.ok(initialList.body.total >= initialList.body.data.length);

    const sku = `IT-${randomUUID()}`;
    createdSku = sku;
    const name = `Integration ${randomUUID()}`;
    const created = await request(port, {
      method: 'POST',
      path: '/api/products',
      body: { sku, name, category: 'Pruebas', price: 12.5, stock: 2 },
    });
    creationSucceeded = created.status === 201;
    if (creationSucceeded && typeof created.body?._id === 'string') createdId = created.body._id;
    assert.equal(created.status, 201);
    assert.equal(created.body.sku, sku);
    assert.equal(created.body.stock, 2);

    const filteredList = await request(port, {
      path: `/api/products?page=1&limit=10&search=${encodeURIComponent(name)}`,
    });
    assert.equal(filteredList.status, 200);
    assert.ok(filteredList.body.data.some((product) => product._id === createdId));
    assert.equal(filteredList.body.total, 1);

    const adjusted = await request(port, {
      method: 'PATCH',
      path: `/api/products/${createdId}/stock`,
      body: { amount: 3 },
    });
    assert.equal(adjusted.status, 200);
    assert.equal(adjusted.body.stock, 5);

    const persisted = await Product.findById(createdId).lean();
    assert.equal(persisted.stock, 5);

    const deleted = await request(port, { method: 'DELETE', path: `/api/products/${createdId}` });
    assert.equal(deleted.status, 204);
    const missing = await request(port, { path: `/api/products/${createdId}` });
    assert.equal(missing.status, 404);
  } finally {
    try {
      if (server?.listening) await close(server);
      if (mongoose.connection.readyState === 1 && creationSucceeded) {
        // A 201 confirms this request created the uniquely generated SKU; clean only that document.
        const cleanupFilter = createdId ? { _id: createdId } : { sku: createdSku };
        await Product.deleteOne(cleanupFilter);
      }
    } finally {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    }
  }
});

const express = require('express');
const productsRoutes = require('./routes/products.routes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productsRoutes);

module.exports = app;

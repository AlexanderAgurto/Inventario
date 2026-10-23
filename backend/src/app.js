import express from 'express';
import productsRoutes from './routes/products.routes.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productsRoutes);

export default app;

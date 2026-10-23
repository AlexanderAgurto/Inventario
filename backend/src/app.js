import express from 'express';
import productsRoutes from './routes/products.routes.js';
import { corsMiddleware } from './middleware/cors.js';
import { HttpError } from './errors/http-error.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/products', productsRoutes);
app.use((req, res, next) => next(new HttpError(404, 'ROUTE_NOT_FOUND', 'No se encontró la ruta solicitada.')));
app.use(errorHandler);

export default app;

import Product from '../models/Product.js';
import { HttpError } from '../errors/http-error.js';
import {
  assertValidProductId,
  buildStockAdjustmentFilter,
  escapeRegex,
  parsePagination,
  parseProductInput,
  parseStockAdjustment,
} from '../utils/validation.js';

export const list = async (req, res) => {
  const { page, limit, search } = parsePagination(req.query);
  const filter = search ? { name: new RegExp(escapeRegex(search), 'i') } : {};
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ data, page, limit, total });
};

export const getById = async (req, res) => {
  assertValidProductId(req.params.id);
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el producto.');
  res.status(200).json(product);
};

export const create = async (req, res) => {
  const product = await Product.create(parseProductInput(req.body));
  res.status(201).json(product);
};

export const adjustStock = async (req, res) => {
  assertValidProductId(req.params.id);
  const amount = parseStockAdjustment(req.body);
  const filter = buildStockAdjustmentFilter(req.params.id, amount);

  const product = await Product.findOneAndUpdate(
    filter,
    { $inc: { stock: amount } },
    { new: true, runValidators: true }
  );
  if (!product) {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el producto.');
    throw new HttpError(409, 'STOCK_CONFLICT', 'El stock actual no permite aplicar el ajuste solicitado.');
  }
  res.json(product);
};

export const remove = async (req, res) => {
  assertValidProductId(req.params.id);
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'No se encontró el producto.');
  res.status(204).send();
};

const Product = require('../models/Product');

exports.list = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const filter = {};
  if (req.query.search) {
    filter.name = new RegExp(req.query.search, 'i');
  }

  const skip = page * limit;

  const [data, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ data, page, limit, total });
};

exports.getById = async (req, res) => {
  const product = await Product.findById(req.params.id);
  res.status(200).json(product);
};

exports.create = async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
};

exports.adjustStock = async (req, res) => {
  const product = await Product.findById(req.params.id);
  product.stock += req.body.delta;
  res.json(product);
};

exports.remove = async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.status(204).send();
};

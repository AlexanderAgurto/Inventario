export interface Product {
  _id: string;
  sku: string;
  name: string;
  category?: string;
  price: number;
  stock: number;
  createdAt?: string;
  updatedAt?: string;
}

export type NewProduct = Pick<Product, 'sku' | 'name' | 'price'> &
  Partial<Pick<Product, 'category' | 'stock'>>;

export interface ProductPage {
  data: Product[];
  page: number;
  limit: number;
  total: number;
}

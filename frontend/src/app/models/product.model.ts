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

export interface ProductPage {
  data: Product[];
  page: number;
  limit: number;
  total: number;
}

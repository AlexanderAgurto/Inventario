import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads all pages reported by the API before emitting the product list', () => {
    const firstPage = Array.from({ length: 100 }, (_, index): Product => ({
      _id: `product-${index}`, sku: `SKU-${index}`, name: `Producto ${index}`, price: 1, stock: 1,
    }));
    const secondProduct: Product = { _id: 'last', sku: 'SKU-LAST', name: 'Último', price: 2, stock: 1 };
    let result: Product[] | undefined;

    service.getAll().subscribe((products) => result = products);
    const firstRequest = http.expectOne('http://localhost:3000/api/products?page=1&limit=100');
    firstRequest.flush({ data: firstPage, page: 1, limit: 100, total: 101 });
    const secondRequest = http.expectOne('http://localhost:3000/api/products?page=2&limit=100');
    secondRequest.flush({ data: [secondProduct], page: 2, limit: 100, total: 101 });

    expect(result).toHaveLength(101);
    expect(result?.at(-1)).toEqual(secondProduct);
  });
});

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { NewProduct, Product, ProductPage } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/products';

  getAll(): Observable<Product[]> {
    const limit = 100;
    const fetchPage = (page: number) =>
      this.http.get<ProductPage>(`${this.apiUrl}?page=${page}&limit=${limit}`);

    return fetchPage(1).pipe(
      expand((response) =>
        response.page * response.limit < response.total
          ? fetchPage(response.page + 1)
          : EMPTY
      ),
      reduce((products, response) => products.concat(response.data), [] as Product[])
    );
  }

  create(product: NewProduct): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  adjustStock(id: string, amount: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}/stock`, { amount });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

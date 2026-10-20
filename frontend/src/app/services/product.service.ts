import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { Product, ProductPage } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/products';

  getAll(page = 1, limit = 10): Observable<Product[]> {
    return this.http
      .get<ProductPage>(`${this.apiUrl}?page=${page}&limit=${limit}`)
      .pipe(
        map((res) => res.data),
        catchError(() => of([]))
      );
  }

  create(product: Omit<Product, '_id'>): Observable<Product> {
    return this.http.post<Product>(this.apiUrl, product);
  }

  adjustStock(id: string, amount: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/${id}/stock`, { amount });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

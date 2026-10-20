import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { interval } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-inventory-page',
  templateUrl: './inventory-page.html',
})
export class InventoryPage implements OnInit {
  private readonly productService = inject(ProductService);

  protected readonly products = signal<Product[]>([]);

  // mostrar el valor total del inventario. Ver README.
  protected readonly totalValue = computed(() => '0.00');

  ngOnInit(): void {
    this.load();
    interval(5000).subscribe(() => this.load());
  }

  protected load(): void {
    this.productService.getAll().subscribe((products) => this.products.set(products));
  }

  protected increase(product: Product): void {
    this.productService.adjustStock(product._id, 1).subscribe();
  }

  protected remove(id: string): void {
    this.productService.remove(id);
  }
}

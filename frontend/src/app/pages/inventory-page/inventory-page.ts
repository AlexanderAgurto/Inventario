import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { interval } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';

const nonWhitespace: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { whitespace: true };

const finiteNonNegativeNumber: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? null
    : { finiteNonNegative: true };
};

const optionalSafeInteger: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value;
  return value === null || value === '' || (Number.isSafeInteger(value) && value >= 0)
    ? null
    : { safeInteger: true };
};

@Component({
  selector: 'app-inventory-page',
  imports: [ReactiveFormsModule],
  templateUrl: './inventory-page.html',
})
export class InventoryPage implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly products = signal<Product[]>([]);
  protected readonly isSubmitting = signal(false);
  protected readonly createError = signal('');
  protected readonly createSuccess = signal('');
  protected readonly productForm = this.formBuilder.group({
    sku: ['', [Validators.required, Validators.maxLength(64), nonWhitespace]],
    name: ['', [Validators.required, Validators.maxLength(120), nonWhitespace]],
    category: ['', [Validators.maxLength(120)]],
    price: this.formBuilder.control<number | null>(null, [Validators.required, finiteNonNegativeNumber]),
    stock: this.formBuilder.control<number | null>(0, [optionalSafeInteger]),
  });

  // mostrar el valor total del inventario. Ver README.
  protected readonly totalValue = computed(() => '0.00');

  ngOnInit(): void {
    this.load();
    interval(5000).subscribe(() => this.load());
  }

  protected load(): void {
    this.productService.getAll().subscribe((products) => this.products.set(products));
  }

  protected createProduct(): void {
    if (this.isSubmitting()) return;

    this.productForm.markAllAsTouched();
    this.createError.set('');
    this.createSuccess.set('');
    if (this.productForm.invalid) return;

    const { sku, name, category, price, stock } = this.productForm.getRawValue();
    const productInput = {
      sku: sku.trim(),
      name: name.trim(),
      ...(category.trim() ? { category: category.trim() } : {}),
      price: price as number,
      ...(stock !== null ? { stock } : {}),
    };

    this.isSubmitting.set(true);
    this.productService.create(productInput).subscribe({
      next: (product) => {
        this.products.update((products) => [product, ...products]);
        this.productForm.reset({ sku: '', name: '', category: '', price: null, stock: 0 });
        this.createSuccess.set(`Producto ${product.sku} creado correctamente.`);
        this.isSubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => {
        const apiMessage = error.error?.error?.message;
        this.createError.set(
          typeof apiMessage === 'string'
            ? apiMessage
            : error.status === 0
              ? 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.'
              : 'No se pudo crear el producto. Revisa los datos e inténtalo de nuevo.'
        );
        this.isSubmitting.set(false);
      },
    });
  }

  protected increase(product: Product): void {
    this.productService.adjustStock(product._id, 1).subscribe();
  }

  protected remove(id: string): void {
    this.productService.remove(id);
  }
}

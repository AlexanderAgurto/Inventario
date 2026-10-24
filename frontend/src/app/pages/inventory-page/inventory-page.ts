import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize, interval } from 'rxjs';
import { calculateInventoryValue } from '../../legacy/inventory-calc';
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly products = signal<Product[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal('');
  protected readonly actionError = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly stockUpdatingIds = signal(new Set<string>());
  protected readonly deletingIds = signal(new Set<string>());
  protected readonly createError = signal('');
  protected readonly createSuccess = signal('');
  protected readonly productForm = this.formBuilder.group({
    sku: ['', [Validators.required, Validators.maxLength(64), nonWhitespace]],
    name: ['', [Validators.required, Validators.maxLength(120), nonWhitespace]],
    category: ['', [Validators.maxLength(120)]],
    price: this.formBuilder.control<number | null>(null, [Validators.required, finiteNonNegativeNumber]),
    stock: this.formBuilder.control<number | null>(0, [optionalSafeInteger]),
  });

  protected readonly totalValue = computed(() =>
    calculateInventoryValue(
      this.products().map((product) => ({
        sku: product.sku,
        qty: product.stock,
        unitPriceCents: Math.round((product.price + Number.EPSILON) * 100),
      }))
    )
  );
  private hasLoaded = false;
  private loadInProgress = false;

  ngOnInit(): void {
    this.load();
    interval(5000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  protected load(): void {
    if (this.loadInProgress) return;
    this.loadInProgress = true;
    if (!this.hasLoaded) this.isLoading.set(true);

    this.productService.getAll().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loadError.set('');
        this.hasLoaded = true;
        this.isLoading.set(false);
        this.loadInProgress = false;
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(this.getRequestErrorMessage(error, 'No se pudo cargar el inventario.'));
        this.hasLoaded = true;
        this.isLoading.set(false);
        this.loadInProgress = false;
      },
    });
  }

  protected retryLoad(): void {
    this.isLoading.set(true);
    this.load();
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
    if (this.stockUpdatingIds().has(product._id)) return;
    this.actionError.set('');
    this.setPending(this.stockUpdatingIds, product._id, true);
    this.productService.adjustStock(product._id, 1).pipe(
      finalize(() => this.setPending(this.stockUpdatingIds, product._id, false))
    ).subscribe({
      next: (updatedProduct) => {
        this.products.update((products) =>
          products.map((current) => current._id === updatedProduct._id ? updatedProduct : current)
        );
      },
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.getRequestErrorMessage(error, 'No se pudo actualizar el stock.'));
      },
    });
  }

  protected remove(id: string): void {
    if (this.deletingIds().has(id)) return;
    this.actionError.set('');
    this.setPending(this.deletingIds, id, true);
    this.productService.remove(id).pipe(
      finalize(() => this.setPending(this.deletingIds, id, false))
    ).subscribe({
      next: () => this.products.update((products) => products.filter((product) => product._id !== id)),
      error: (error: HttpErrorResponse) => {
        this.actionError.set(this.getRequestErrorMessage(error, 'No se pudo eliminar el producto.'));
      },
    });
  }

  private getRequestErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.error?.message;
    if (typeof apiMessage === 'string') return apiMessage;
    if (error.status === 0) return 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
    return fallback;
  }

  private setPending(signalValue: WritableSignal<Set<string>>, id: string, pending: boolean): void {
    signalValue.update((ids) => {
      const next = new Set(ids);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}

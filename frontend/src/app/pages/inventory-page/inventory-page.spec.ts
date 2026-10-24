import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductService } from '../../services/product.service';
import { InventoryPage } from './inventory-page';
import { vi } from 'vitest';

const existingProduct: Product = {
  _id: 'product-1', sku: 'SKU-1', name: 'Teclado', category: 'Accesorios', price: 1.25, stock: 2,
};
const createdProduct: Product = {
  _id: 'product-2', sku: 'SKU-2', name: 'Ratón', price: 2, stock: 3,
};

function createPage(getAll: () => Observable<Product[]> = () => of([existingProduct])) {
  const service = {
    getAll: vi.fn(getAll),
    create: vi.fn(() => of(createdProduct)),
    adjustStock: vi.fn(() => of({ ...existingProduct, stock: 3 })),
    remove: vi.fn<() => Observable<void>>(() => of(undefined)),
  };
  TestBed.configureTestingModule({
    imports: [InventoryPage],
    providers: [{ provide: ProductService, useValue: service }],
  });
  const fixture = TestBed.createComponent(InventoryPage);
  fixture.detectChanges();
  return { fixture, service };
}

describe('InventoryPage', () => {
  it('shows loading state until an empty response arrives, then shows the empty inventory state', () => {
    const request = new Subject<Product[]>();
    const { fixture } = createPage(() => request);
    const page = fixture.nativeElement as HTMLElement;
    const summary = page.querySelector('[aria-label="Valor total del inventario"]')!;

    expect(summary.textContent).toContain('Cargando valor');
    expect(summary.textContent).not.toContain('0.00');
    expect(page.textContent).toContain('Cargando productos');

    request.next([]);
    request.complete();
    fixture.detectChanges();

    expect(summary.textContent).toContain('0.00');
    expect(page.textContent).toContain('Todavía no hay productos en el inventario.');
  });

  it('recalculates the inventory value after create, stock adjustment, and deletion', () => {
    const { fixture, service } = createPage();
    const page = fixture.nativeElement as HTMLElement;
    const input = (selector: string, value: string) => {
      const element = page.querySelector<HTMLInputElement>(selector)!;
      element.value = value;
      element.dispatchEvent(new Event('input'));
    };

    input('#product-sku', 'SKU-2');
    input('#product-name', 'Ratón');
    input('#product-price', '2');
    input('#product-stock', '3');
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(service.create).toHaveBeenCalledWith({ sku: 'SKU-2', name: 'Ratón', price: 2, stock: 3 });
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('8.50');

    const existingRow = page.querySelectorAll('tbody tr')[1];
    existingRow.querySelector<HTMLButtonElement>('button')!.click();
    fixture.detectChanges();
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('9.75');

    existingRow.querySelectorAll<HTMLButtonElement>('button')[1].click();
    fixture.detectChanges();
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('6.00');
  });

  it('hides the total after a load error and restores it after a successful retry', () => {
    const { fixture } = createPage(() => throwError(() => new HttpErrorResponse({ status: 503 })));
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('Valor no disponible');
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).not.toContain('0.00');

    const component = fixture.componentInstance as unknown as { load: () => void };
    const service = TestBed.inject(ProductService) as unknown as { getAll: ReturnType<typeof vi.fn> };
    service.getAll.mockReturnValueOnce(of([existingProduct]));
    component.load();
    fixture.detectChanges();

    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('2.50');
    expect(page.textContent).not.toContain('No se pudo cargar el inventario.');
  });

  it('keeps entered product data and shows the API message when creation fails', () => {
    const { fixture, service } = createPage();
    service.create.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { error: { message: 'El SKU ya existe.' } },
    })));
    const page = fixture.nativeElement as HTMLElement;
    const sku = page.querySelector<HTMLInputElement>('#product-sku')!;
    sku.value = 'SKU-DUPLICADO';
    sku.dispatchEvent(new Event('input'));
    page.querySelector<HTMLInputElement>('#product-name')!.value = 'Producto nuevo';
    page.querySelector<HTMLInputElement>('#product-name')!.dispatchEvent(new Event('input'));
    page.querySelector<HTMLInputElement>('#product-price')!.value = '4';
    page.querySelector<HTMLInputElement>('#product-price')!.dispatchEvent(new Event('input'));
    page.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();

    expect(sku.value).toBe('SKU-DUPLICADO');
    expect(page.textContent).toContain('El SKU ya existe.');
  });

  it('prevents duplicate stock requests while the first request is pending', () => {
    const stockResult = new Subject<Product>();
    const { fixture, service } = createPage();
    service.adjustStock.mockReturnValue(stockResult);
    const page = fixture.nativeElement as HTMLElement;
    const stockButton = page.querySelector<HTMLButtonElement>('tbody button')!;

    stockButton.click();
    fixture.detectChanges();
    expect(stockButton.disabled).toBe(true);
    stockButton.click();
    expect(service.adjustStock).toHaveBeenCalledTimes(1);

    stockResult.next({ ...existingProduct, stock: 3 });
    stockResult.complete();
    fixture.detectChanges();
    expect(stockButton.disabled).toBe(false);
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('3.75');
  });

  it('prevents duplicate delete requests while deletion is pending', () => {
    const deleteResult = new Subject<void>();
    const { fixture, service } = createPage();
    service.remove.mockReturnValue(deleteResult);
    const page = fixture.nativeElement as HTMLElement;
    const deleteButton = page.querySelectorAll<HTMLButtonElement>('tbody button')[1];

    deleteButton.click();
    fixture.detectChanges();
    expect(deleteButton.disabled).toBe(true);
    deleteButton.click();
    expect(service.remove).toHaveBeenCalledTimes(1);

    deleteResult.next();
    deleteResult.complete();
    fixture.detectChanges();
    expect(page.querySelector('tbody')).toBeNull();
    expect(page.querySelector('[aria-label="Valor total del inventario"]')?.textContent).toContain('0.00');
  });
});

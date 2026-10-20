import { Component } from '@angular/core';
import { InventoryPage } from './pages/inventory-page/inventory-page';

@Component({
  selector: 'app-root',
  imports: [InventoryPage],
  template: '<app-inventory-page />',
})
export class App {}

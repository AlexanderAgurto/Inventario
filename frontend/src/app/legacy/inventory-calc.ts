/**
 *   ARCHIVO LEGACY - NO MODIFICAR  
 *
 * Este módulo lo mantiene otro equipo y lo consumen otros sistemas.
 * Cualquier cambio en este archivo invalida la prueba.
 * Si necesitas usarlo, adáptate tú a él.
 */

export interface LegacyItem {
  sku: string;
  qty: number;
  unitPriceCents: number;
}

/** Devuelve el valor total del inventario como texto con 2 decimales. */
export function calculateInventoryValue(items: LegacyItem[]): string {
  const cents = items
    .filter((item) => item.qty > 0)
    .reduce((sum, item) => sum + item.qty * item.unitPriceCents, 0);
  return (cents / 100).toFixed(2);
}

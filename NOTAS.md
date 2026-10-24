# Módulo de inventario

## Cambios realizados

- **Backend ESM:** el servidor, las rutas, el modelo, la conexión y el seed se migraron de CommonJS a ES Modules. Se conservaron los comandos `dev`, `start` y `seed`.
- **API:** se corrigió el desplazamiento de la paginación y se añadieron validaciones, límites de consulta y errores consistentes. Los IDs y productos inexistentes se responden con `400` y `404`; los SKU duplicados, con `409`.
- **Stock:** Angular enviaba `amount`, pero el servidor esperaba `delta` y no persistía el cambio. Ahora `amount` es el campo canónico, `delta` se mantiene como alias compatible y MongoDB aplica el ajuste de forma atómica.
- **Comunicación:** se configuró CORS para el origen local de Angular y se unificó la lectura de `MONGODB_URI`/`MONGO_URI`, sin exponer credenciales en errores de inicio.
- **Angular:** se configuró Tailwind, se añadió el formulario con validaciones y se mejoraron los estados de carga, error y lista vacía. Los cambios de stock y eliminación actualizan la vista después de una respuesta exitosa.
- **Valor total:** se usa `calculateInventoryValue` adaptando precio y stock al formato requerido. `frontend/src/app/legacy/inventory-calc.ts` permanece intacto.

## Decisiones y contrato

- Se conservaron las rutas y respuestas exitosas existentes. El ajuste acepta `{ "amount": entero }` y mantiene `{ "delta": entero }` como alias. Los errores usan `{ "error": { "code", "message" } }` y una eliminación exitosa responde `204`.
- `ProductService` recorre las páginas de la API para obtener el inventario completo. La tabla actual muestra los resultados en una lista continua; no tiene controles de paginación en pantalla.
- El seed ejecuta `Product.deleteMany({})`; no se ejecutó. La suite de integración exige la base aislada `inventario_integration_test` y limpia solo el producto que crea.

## Verificación

- Backend: 17 pruebas unitarias aprobadas.
- Frontend: 8 pruebas aprobadas.
- Integración: 1 suite aprobada contra MongoDB local aislado; verificó listado paginado, creación, stock persistido, eliminación y limpieza del producto temporal.
- `npm run build`: correcto, sin errores ni advertencias.
- La revisión visual manual confirmó carga, formulario, validaciones, acciones, estados y diseño. La navegación visual entre páginas queda limitada por la ausencia de controles en la tabla.

## Mejoras futuras

Añadir controles de paginación visibles y separar la configuración de desarrollo y producción. Evitar ejecutar el seed sobre bases con datos existentes.

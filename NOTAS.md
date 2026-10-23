# Módulo de inventario

## Estado de la solución

El backend ya usa ES Modules (ESM). La corrección de los comportamientos de inventario, la interfaz con Tailwind CSS y el cálculo del valor total siguen pendientes. Las observaciones pendientes de este documento se basan en la implementación actual; no se presentan como correcciones realizadas.

## Problemas encontrados

### Corregido: módulos CommonJS en el backend

**Qué ocurría:** el servidor, las rutas, el controlador, el modelo, la conexión a MongoDB y el seed usaban `require` y `module.exports`, aunque la prueba exige ESM para todo el backend.

**Causa y solución:** los módulos no estaban configurados para ESM. Se añadió `"type": "module"` a `backend/package.json`; los siete archivos JavaScript del backend se migraron a `import`/`export` y los imports locales incluyen `.js`. El seed reemplazó `__dirname` con una ruta derivada de `import.meta.url` y carga `products.json` mediante un import JSON con `with { type: 'json' }`. Se conservaron los comandos `dev`, `start` y `seed`, así como las rutas y respuestas existentes de la API.

**Verificación:** con Node `v22.19.0`, `node --check` pasó en los siete archivos, la aplicación Express se pudo importar como módulo y una prueba aislada cargó los 15 productos JSON. El escaneo no encontró usos residuales de `require`, `module.exports`, `exports.*`, `__dirname` ni `__filename`. No se inició el servidor ni se ejecutó el seed.

### Pendiente: paginación del listado

El controlador calcula `skip` como `page * limit`. Para la página predeterminada 1 y límite 10, omite los primeros diez registros. El frontend solicita una página y solo conserva `res.data`; el seed contiene 15 productos. La causa está en el desplazamiento del backend y en que el cliente no obtiene páginas adicionales. Debe corregirse el cálculo del desplazamiento y acordarse si la interfaz mostrará todas las páginas o si la API ofrecerá el conjunto requerido. No está corregido.

### Pendiente: ajuste de stock

Angular envía `{ amount }` al endpoint `PATCH /api/products/:id/stock`, mientras el controlador espera `delta`. Aunque se enviara el campo esperado, el controlador solo cambia el documento en memoria y responde sin guardarlo en MongoDB. Tampoco valida el ID, la existencia del producto, que la cantidad sea numérica ni que el stock resultante sea válido. Esto impide un ajuste fiable y puede producir errores o stock inválido. Deben alinearse el contrato del cliente y del servidor, validar la operación y persistirla correctamente. No está corregido.

### Pendiente: eliminación y actualización de la interfaz

El método de la página llama a `remove()` sin suscribirse al observable HTTP, por lo que Angular no envía la petición. El ajuste de stock sí se suscribe, pero no utiliza la respuesta para actualizar la lista. La causa es que las mutaciones no completan el ciclo de petición y actualización de estado en la interfaz. Deben manejar la respuesta y reflejar el cambio en la lista y en el total. No está corregido.

### Pendiente: creación de productos

La API tiene una ruta `POST /api/products` y el servicio Angular expone `create()`, pero la pantalla solo contiene un comentario donde debería ir el formulario. Por ello, el usuario no puede crear productos desde la interfaz. Falta construir el formulario, validar los campos en Angular y en la API y presentar el resultado de la operación. No está corregido.

### Pendiente: estados de carga, error y lista vacía

`getAll()` convierte cualquier error HTTP en una lista vacía con `catchError(() => of([]))`. La pantalla no mantiene estados diferenciados de carga, error y ausencia de productos. La causa es que el servicio oculta el error y el componente solo asigna una lista. Deben conservarse los errores para que la interfaz pueda informar el fallo y mostrar estados comprensibles. No está corregido.

### Pendiente: valor total del inventario

La página devuelve siempre `"0.00"` para el valor total. La función obligatoria `calculateInventoryValue` todavía no se importa ni se utiliza. Debe calcularse el total de los productos actuales después de cargar, crear, ajustar o eliminar productos. El archivo protegido `frontend/src/app/legacy/inventory-calc.ts` no debe modificarse: su contrato es `calculateInventoryValue(items: LegacyItem[]): string`, con elementos `{ sku, qty, unitPriceCents }`. La adaptación de productos a ese contrato corresponde al frontend. No está corregido.

### Pendiente: configuración de MongoDB y seed

La conexión del servidor lee `MONGODB_URI` y, si no está definida, usa `mongodb://127.0.0.1:27017/test`. El seed lee `MONGO_URI`, que es la variable definida en `backend/.env.example`. Esta discrepancia puede hacer que servidor y seed usen bases diferentes o que el seed no tenga URI. Además, el seed ejecuta `Product.deleteMany({})` antes de insertar los ejemplos, por lo que puede borrar todos los productos de la base seleccionada. Debe unificarse la configuración y definirse una forma segura de ejecutar el seed. No se cambió ni ejecutó.

### Pendiente: validación, errores HTTP y CORS

La API entrega directamente el cuerpo de la solicitud a `Product.create()` y no tiene validación propia ni middleware centralizado de errores visible. `GET /api/products/:id` responde `200` con `null` cuando no existe el producto; el ajuste puede fallar al acceder a un resultado nulo, y el borrado responde `204` incluso si el ID no correspondía a un producto. Tampoco se encontró configuración de CORS en Express. Estos comportamientos requieren validación y respuestas consistentes; además, el origen Angular (`localhost:4200`) debe poder comunicarse con la API (`localhost:3000`) desde el navegador. No están corregidos ni verificados mediante peticiones HTTP.

## Decisiones técnicas

- **Comunicación Angular–Express:** Angular utiliza `HttpClient` desde `ProductService` y la API conserva la base `http://localhost:3000/api/products`, con rutas para listar, crear, ajustar stock y eliminar. La migración ESM no cambió rutas ni formatos de respuesta. La integración completa sigue pendiente porque el cuerpo de ajuste de stock no coincide y CORS no está configurado.
- **Persistencia:** Express usa Mongoose y el modelo `Product` para consultar MongoDB. La conexión del servidor usa `MONGODB_URI` o el fallback local indicado arriba. No se ha confirmado una conexión real; la persistencia del ajuste de stock no funciona actualmente porque no se guarda el documento.
- **Errores y validaciones:** la implementación actual solo incluye validaciones del esquema Mongoose y no distingue de forma suficiente entradas inválidas, IDs malformados, recursos inexistentes y errores internos. El servicio Angular también transforma errores de listado en listas vacías. Una estrategia centralizada y respuestas coherentes son trabajo pendiente.
- **ESM:** se habilitó ESM a nivel de paquete para migrar todo el backend, incluido el seed, sin renombrar archivos ni cambiar los scripts existentes. Las rutas locales usan extensión explícita. El seed resuelve `.env` desde la ubicación del propio módulo, no desde el directorio actual del proceso.
- **Cálculo del inventario:** se utilizará `calculateInventoryValue` sin modificar el archivo legacy. La función espera cantidades y precios unitarios en centavos; el frontend deberá convertir los productos actuales a ese contrato y recalcular el total al cambiar la lista. Esta integración aún no está implementada.
- **Tailwind CSS:** no está instalado ni configurado actualmente. La prueba requiere incorporarlo y aplicarlo a la pantalla; se elegirá una versión compatible con Angular y Node del proyecto cuando se implemente esa parte.

## Pruebas y comprobaciones

**Ejecutadas:** comprobaciones de sintaxis con `node --check` para los siete módulos migrados; parseo de `backend/package.json`; import ESM de la aplicación; escaneo estático de patrones CommonJS; `git diff --check`; prueba aislada de import JSON con Node `v22.19.0` (15 productos); y comprobación de que la ruta del seed apunta a `backend/.env` sin leer su contenido. Todas pasaron.

**Pendientes:** no se ejecutaron `npm run dev`, `npm start` ni `npm run seed`. No se verificó la conexión a MongoDB ni se hicieron peticiones HTTP. El seed no se ejecutó porque borra los productos existentes antes de insertarlos. Tampoco se ejecutaron `ng build`, `ng test` ni pruebas de integración Angular–API. Por tanto, no se afirma que la aplicación completa compile, arranque o funcione de extremo a extremo.

## Requisitos de la prueba todavía pendientes

- Corregir los comportamientos de listado, creación, ajuste de stock y eliminación.
- Implementar validación de entrada y manejo coherente de errores en la API.
- Integrar formulario y estados de carga, error, éxito y lista vacía en Angular.
- Configurar Tailwind y aplicarlo a la pantalla.
- Calcular el valor total con `calculateInventoryValue` y actualizarlo tras cada mutación.
- Verificar `ng build` sin errores ni advertencias nuevas, además de las pruebas de backend e integración que puedan ejecutarse de forma segura.
- Resolver la configuración de MongoDB y verificar la inicialización de datos sin riesgo para datos existentes.

## Mejoras futuras

Una vez satisfechos los requisitos obligatorios, mejoraría la configuración para separar valores de desarrollo y producción, añadiría pruebas automatizadas para validaciones y casos límite, y definiría una estrategia de despliegue y observabilidad adecuada. Estas mejoras son adicionales; no sustituyen los requisitos pendientes enumerados arriba.

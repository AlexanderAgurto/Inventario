# Prueba técnica: Módulo de Inventario

**Stack:** Angular (standalone) + Tailwind CSS · Node.js + Express + MongoDB local

## Contexto

Recibes un módulo de inventario ya iniciado por otro desarrollador: una API REST y una interfaz Angular. El módulo permite listar productos, crear productos, ajustar su stock y eliminarlos.

El proyecto **compila y arranca**, pero **no todo se comporta como debería**. Parte de tu trabajo es revisar el código, entender qué hace y dejarlo funcionando de forma correcta y mantenible.

Aplica las mejores prácticas que conozcas, tanto en el backend como en el frontend. Se evalúa cómo razonas, no solo el resultado.

## Requisitos previos

- Node.js (LTS reciente) y npm
- MongoDB corriendo en local (`mongodb://127.0.0.1:27017`)
- Angular CLI

## Puesta en marcha

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run seed     # carga datos de ejemplo
npm run dev

# Frontend (otra terminal)
cd frontend
npm install
npx ng serve
```

API en `http://localhost:3000` · Frontend en `http://localhost:4200`.

## Tareas

### 1. Backend: migrar a ES Modules
El backend está escrito en CommonJS. Migra **todo** el backend (incluido el script de seed) a ES Modules (ESM). `npm run dev`, `npm start` y `npm run seed` deben seguir funcionando.

### 2. Backend y frontend: encontrar y corregir fallos de comportamiento
Hay comportamientos incorrectos tanto en la API como en la aplicación Angular, y en la comunicación entre ambas. No se indica dónde están. Pruebas la aplicación, lees el código, los encuentras y los corriges.

Además, la API todavía no está lista para producción. Mejórala como lo harías en un proyecto real.

### 3. Frontend: interfaz con Tailwind CSS
- Instala y configura **Tailwind CSS** en el proyecto Angular (no viene instalado).
- Aplica estilos a toda la pantalla de inventario con Tailwind (tabla, botones, estados).
- Construye por tu cuenta el **formulario de creación de productos** y haz que funcione contra la API.
- La interfaz debe comunicar claramente los estados de carga, error y lista vacía.

### 4. Valor total del inventario
La pantalla debe mostrar el **valor total del inventario** (suma de precio × stock de todos los productos).

Existe una función ya hecha para esto en `frontend/src/app/legacy/inventory-calc.ts`.

> **Ese archivo NO se puede modificar.** Debes usar `calculateInventoryValue` tal como está. Si tu solución requiere editarlo, no es la solución correcta.

### 5. Documenta en `NOTAS.md`
Crea un archivo `NOTAS.md` en la raíz con:
- Cada problema que encontraste: qué pasaba, por qué, y cómo lo corregiste.
- Decisiones técnicas importantes (por ejemplo, cómo resolviste la comunicación entre frontend y backend, y por qué).
- Qué mejorarías si tuvieras más tiempo.

## Reglas

- Usa la última versión estable de las herramientas que instales.
- No cambies el comportamiento público de la API sin documentarlo en `NOTAS.md`.
- Haz commits pequeños y con mensajes claros.
- El código debe pasar `ng build` sin errores ni advertencias nuevas.

## Entrega

Repositorio (o zip sin `node_modules`) con tu solución y el `NOTAS.md`.

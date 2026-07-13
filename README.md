# Pancko Automotor

Microapp PWA local para cotizar colores de la línea automotor.

## Qué hace

- Calcula cuánto pagar a Pablo.
- Calcula cuánto cobrar al cliente.
- Permite cargar varios importes de material aportado por la pinturería.
- Usa porcentajes diferentes de ganancia para la parte de Pablo y la parte propia.
- Guarda historial local con IndexedDB.
- Permite abrir, editar, duplicar y eliminar cálculos.
- Exporta e importa un respaldo JSON.
- Funciona offline después de la primera carga.
- Puede instalarse en Android, Windows y otros sistemas compatibles con PWA.

## Fórmulas usadas

```text
Parte fórmula Pablo = Total fórmula - Material propio

Pago a Pablo =
Parte fórmula Pablo × (1 - descuento) × porcentaje Pablo

Valor base material propio =
Material propio × (1 - descuento) × porcentaje Pablo

Cobro parte Pablo =
Pago a Pablo × (1 + ganancia parte Pablo)

Cobro parte propia =
Valor base material propio × (1 + ganancia material propio)

Total a cobrar =
Cobro parte Pablo + Cobro parte propia
```

## Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub.
2. Subí todos los archivos de esta carpeta conservando la estructura.
3. En el repositorio abrí **Settings → Pages**.
4. En **Build and deployment**, elegí **Deploy from a branch**.
5. Seleccioná la rama `main` y la carpeta `/ (root)`.
6. Guardá. GitHub mostrará la dirección pública de la app.

Los enlaces internos son relativos, por lo que funciona aunque el repositorio no esté en la raíz del dominio.

## Actualizaciones

Cuando cambies archivos y publiques una versión nueva, modificá `CACHE_NAME` en `sw.js`, por ejemplo:

```js
const CACHE_NAME = "pancko-automotor-v1.0.1";
```

Esto obliga al service worker a renovar el caché offline.

## Datos locales

El historial queda guardado en el navegador/dispositivo. Borrar los datos del sitio elimina el historial, por eso conviene exportar respaldos periódicamente.

# Pancko Automotor v1.1.0

Microapp PWA local para cotizar colores de la línea automotor.

## Cambios de esta versión

- Nueva pantalla de inicio limpia con tres accesos: Cotizar color, Historial y Ajustes.
- Cotizador más compacto y ordenado para celular.
- Cada básico y su importe aparecen en una sola línea.
- Se eliminó el botón Calcular: el resultado se actualiza en vivo mientras se cargan los datos.
- Se mantiene el historial local existente de la versión anterior.
- Nuevo caché PWA `v1.1.0` para distribuir la actualización.

## Qué hace

- Calcula cuánto pagar a Pablo.
- Calcula cuánto cobrar al cliente.
- Permite cargar varios importes de material aportado por la pinturería.
- Usa porcentajes diferentes de ganancia para la parte de Pablo y la parte propia.
- Guarda historial local con IndexedDB.
- Permite abrir, editar, duplicar y eliminar cálculos.
- Exporta e importa un respaldo JSON.
- Funciona offline después de la primera carga.
- Puede instalarse como PWA.

## Publicar la actualización

Reemplazá en el repositorio los archivos de la versión anterior por todos los archivos de esta carpeta, conservando la carpeta `icons`.

GitHub Pages puede tardar uno o dos minutos en publicar. Como la app usa caché offline, en un dispositivo que ya tenía la versión anterior puede ser necesario:

1. Abrir la app con internet.
2. Cerrarla completamente.
3. Volver a abrirla.

El historial no se borra porque la base local conserva el mismo nombre y estructura.

---
description: Estrategia para implementar la edición de órdenes existentes
---

# Estrategia de Implementación: Edición de Órdenes

## 1. Objetivo
Permitir a los usuarios modificar una orden de trabajo existente, incluyendo datos generales (cliente, fechas, notas) y su contenido (items de producción y servicios adicionales).

## 2. Desafíos Técnicos
- **Integridad de Datos:** Las órdenes pueden estar en proceso. Editar items que ya tienen avance de producción es riesgoso.
- **Cálculo de Totales:** Cualquier cambio en items/servicios requiere recalcular subtotales, impuestos y totales.
- **Complejidad de UI:** La interfaz de creación (`CreateOrderPage`) es muy compleja (wizard, selección de productos). Duplicarla para edición sería ineficiente.

## 3. Estrategia Propuesta: Reutilización de `CreateOrderPage`

En lugar de crear una página nueva, adaptaremos `CreateOrderPage.tsx` para soportar un modo "Edición".

### A. Routing
Crear una nueva ruta:
- Ruta actual de creación: `/app/orders/create`
- Nueva ruta de edición: `/app/orders/edit/:id`

### B. Adaptación de `CreateOrderPage`
1. **Prop `mode` e `initialId`:** El componente aceptará props opcionales o leerá params de la URL para determinar si está editando.
2. **Carga de Datos (Hydration):**
   - Si es edición, cargar la orden completa usando `useOrdenTrabajo.getOrdenById(id)`.
   - Transformar la data de `OrdenTrabajoFull` al formato de estado local del formulario (`ordenData`, `items`, etc.).
   - Mapear `orden.items` a items de la UI.
   - Mapear `orden.servicios` a servicios de la UI.

### C. Lógica de Guardado (`handleSave`)
Diferenciar entre `create` y `update`:
- **Create:** Llama a `createOrdenConItems`.
- **Update:** Llamará a una nueva función `updateOrdenCompleta`.

### D. Nueva Función Backend (`updateOrdenCompleta` en `useOrdenTrabajo`)
Esta es la parte más crítica. Debe manejar la "diferencia" (diff) entre lo que había y lo nuevo.

**Estrategia "Smart Update":**
1. **Cabecera (`ordenes_trabajo`):** Update simple (cliente, notas, fechas, totales).
2. **Servicios (`ordenes_trabajo_servicios`):**
   - Borrar todos los servicios de esta orden (`DELETE WHERE orden_id = X`).
   - Insertar los nuevos servicios recibidos.
   - *Nota:* Como los servicios no tienen tracking de producción, borrarlos y recrearlos es seguro y simple.
3. **Items (`ordenes_trabajo_items`):**
   - **Nuevos items (sin ID):** Insertar.
   - **Items eliminados:** Detectar cuáles faltan y hacer `DELETE`.
   - **Items existentes (con ID):** Hacer `UPDATE` de campos editables (cantidad, precio, descripción, configuración).
   - **Restricción:** Validar si se permite editar items que ya tienen avance (ej: estado != 'pendiente').

## 4. Pasos de Implementación

1. **Backend (Hook):** Implementar `updateOrdenCompleta` en `useOrdenTrabajo.ts`.
2. **Routing:** Configurar la ruta `/app/orders/edit/:id` en `App.tsx` apuntando a `CreateOrderPage`.
3. **Frontend (Page):**
   - Agregar lógica `useEffect` en `CreateOrderPage` para cargar datos si hay ID.
   - Adaptar `handleCreateOrden` para llamar a `update` si es edición.
   - Agregar validaciones (ej: no permitir editar si la orden está 'finalizada').
4. **UI (Detail):** Agregar botón "Editar Orden" en `OrderDetailPage` que navegue a la nueva ruta.

## 5. Consideraciones de Seguridad
- Solo permitir edición si el estado es 'pendiente' o 'en_proceso' (con permisos de admin).
- Si la orden está 'finalizada' o 'cancelada', la edición debe estar bloqueada.

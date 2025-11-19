# Wizard de Items - Fase 1 Implementado

## Resumen

Se ha implementado exitosamente el wizard completo de configuración de items para productos de **Impresión Laser**. El wizard reemplaza el modal básico anterior y proporciona una experiencia guiada paso a paso para configurar productos con todas sus opciones.

## Archivos Creados

### Tipos y Documentación
- `/docs/LOGICA_NEGOCIO_WIZARD.md` - Documentación completa de la lógica de negocio
- `/src/types/wizard.ts` - Definiciones TypeScript para todo el sistema de wizard

### Hooks
- `/src/hooks/wizard/useWizardState.ts` - Manejo del estado global del wizard
- `/src/hooks/wizard/useWizardValidation.ts` - Validaciones por paso
- `/src/hooks/wizard/useProductSearch.ts` - Búsqueda de productos con debounce
- `/src/hooks/wizard/useImpresionLaserPricing.ts` - Cálculo de precios en tiempo real

### Componentes Core
- `/src/components/wizard/WizardNavigation.tsx` - Botones de navegación
- `/src/components/wizard/StepIndicator.tsx` - Indicador visual de progreso
- `/src/components/wizard/PriceSummaryPanel.tsx` - Panel de resumen de precios

### Pasos del Wizard
- `/src/components/wizard/steps/ProductSearchStep.tsx` - Paso 1: Búsqueda de producto
- `/src/components/wizard/steps/QuantityStep.tsx` - Paso 2: Selección de cantidad
- `/src/components/wizard/steps/SizeStep.tsx` - Paso 3: Selección de medida
- `/src/components/wizard/steps/PrintConfigStep.tsx` - Paso 4: Configuración de impresión
- `/src/components/wizard/steps/ServicesStep.tsx` - Paso 5: Servicios adicionales
- `/src/components/wizard/steps/FinishingsStep.tsx` - Paso 6: Acabados finales
- `/src/components/wizard/steps/SummaryStep.tsx` - Paso 7: Resumen final

### Utilidades
- `/src/utils/wizard/buildOrdenItem.ts` - Construcción del item final
- `/src/utils/wizard/validateItemConfiguration.ts` - Validación completa

### Componente Principal
- `/src/components/wizard/AddItemWizard.tsx` - Orquestador principal del wizard

## Archivos Modificados

- `/src/components/orders/OrdenItemsTab.tsx`
  - Importa `AddItemWizard` en lugar de `AddItemModal`
  - Actualiza `handleAgregarItem` para manejar el formato del wizard
  - Mejora `formatearConfiguracion` para mostrar correctamente los datos del wizard

## Características Implementadas

### 1. Búsqueda Inteligente
- Búsqueda con debounce de 300ms
- Filtrado por nombre y descripción
- Muestra información relevante: categoría, material, precios desde
- Indicadores visuales de productos sin precios configurados

### 2. Selección de Cantidad
- Soporte para tipo de venta "unidad" (input libre)
- Soporte para tipo de venta "cantidad_fija" (botones predefinidos)
- Validación de cantidad mínima
- Interfaz adaptativa según el tipo de producto

### 3. Selección de Medida
- Grid visual de medidas disponibles
- Solo muestra medidas con precios configurados
- Formato claro: "21 x 29.7 cm"

### 4. Configuración de Impresión
- Selección de tipo de tinta (CMYK o K)
- Selección de caras a imprimir (frente / frente y dorso)
- Iconos y descripciones visuales
- Validación de opciones disponibles

### 5. Servicios y Acabados
- Carga dinámica desde la base de datos
- Soporte para múltiples selecciones
- Sistema de niveles con dropdown
- Cálculo de impacto en precio en tiempo real
- Muestra el incremento de precio por cada servicio/acabado

### 6. Cálculo de Precios
- Consulta automática a la tabla de precios
- Aplicación de servicios según tipo de impacto (porcentaje, monto fijo, ambos)
- Aplicación de acabados según tipo de impacto
- Panel sticky con desglose completo
- Advertencia cuando no hay precio configurado

### 7. Resumen Final
- Vista completa de toda la configuración
- Desglose detallado de precio
- Permite volver a cualquier paso para editar
- Confirmación antes de agregar

## Flujo del Usuario

1. Click en "Agregar Item"
2. **Paso 1**: Busca y selecciona un producto
3. **Paso 2**: Define la cantidad requerida
4. **Paso 3**: Selecciona la medida/tamaño
5. **Paso 4**: Configura tipo de tinta y caras a imprimir
6. **Paso 5**: Opcionalmente agrega servicios
7. **Paso 6**: Opcionalmente agrega acabados
8. **Paso 7**: Revisa el resumen y confirma

En cada paso:
- El panel de precio se actualiza automáticamente
- Se valida que los datos sean correctos antes de avanzar
- Se puede volver atrás sin perder información
- Se muestra progreso visual con el indicador de pasos

## Validaciones Implementadas

### Por Paso
- **Paso 1**: Producto seleccionado y activo
- **Paso 2**: Cantidad válida según tipo de venta y cantidad mínima
- **Paso 3**: Medida seleccionada y disponible
- **Paso 4**: Tinta y cara impresa seleccionadas
- **Paso 5**: Si servicio con niveles, nivel seleccionado
- **Paso 6**: Si acabado con niveles, nivel seleccionado
- **Paso 7**: Configuración completa y consistente

### Final
- Todos los campos obligatorios completos
- Configuración válida según reglas de negocio
- Advertencia si no hay precio (pero permite continuar)

## Manejo de Errores

- Estados de carga con spinners
- Mensajes de error específicos y accionables
- Advertencias para precios no configurados
- Confirmación al cancelar si hay cambios
- Prevención de pérdida de datos accidental

## Integración con Sistema Existente

- Compatible con estructura de `OrdenTrabajoItem`
- Genera campo `configuracion` con todos los datos
- Calcula `precio_unitario` y `subtotal` correctamente
- Mantiene compatibilidad con sistema de visualización existente

## Estado del Proyecto

✅ **Build exitoso** - El proyecto compila sin errores
✅ **Tipos completos** - TypeScript completamente tipado
✅ **Documentación** - Lógica de negocio documentada
✅ **Modular** - Código organizado y mantenible
✅ **Extensible** - Preparado para agregar más categorías

## Próximos Pasos Sugeridos

### Fase 2: Gran Formato
- Adaptar pasos para medidas variables (ancho libre)
- Implementar selector de acabados específicos
- Integrar con tabla `productos_gran_formato_precios`

### Fase 3: Materiales Rígidos
- Implementar selector de espesores múltiples
- Manejo de dimensiones de materia prima
- Integrar con tabla `productos_materiales_rigidos_precios`

### Fase 4: Otras Categorías
- Plotter de Corte
- Portabanners
- Sellos

### Mejoras Futuras
- Guardar borradores de configuración
- Historial de configuraciones recientes
- Plantillas de configuración
- Validación de stock en tiempo real
- Sugerencias inteligentes basadas en historial

## Conclusión

La Fase 1 del wizard está completamente funcional y lista para usar. Proporciona una experiencia de usuario superior al modal básico anterior, con validaciones robustas, cálculo de precios en tiempo real, y una estructura extensible para agregar más categorías de productos en el futuro.

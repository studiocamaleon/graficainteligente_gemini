# Resumen: Corrección de Horarios en Tracking y WhatsApp

## Problema Identificado

1. **Tracking de órdenes**: Mostraba "Consultar horarios" en lugar de los horarios configurados en el perfil de empresa
2. **Notificaciones WhatsApp**: No incluía los horarios de retiro al notificar que una orden está lista

## Solución Implementada

### 1. Debugging en Frontend (src/utils/timeUtils.ts)
- Agregado logging exhaustivo en `formatBusinessHoursForDisplay` para identificar por qué recibe arrays vacíos
- Los logs mostrarán:
  - El valor recibido de horarios
  - Tipo de dato y si es array
  - Longitud del array
  - Contenido detallado de cada elemento

### 2. Edge Function para WhatsApp (supabase/functions/notify-orden-finalizada/index.ts)

**Cambios principales:**

- **Nueva función `formatBusinessHours`**: Formatea el array de horarios en texto legible
  - Maneja horarios cerrados
  - Agrupa días consecutivos con el mismo horario
  - Maneja horarios divididos (ej: "9:00-12:00 y 15:00-19:00")
  - Retorna "Consultar horarios" si no hay configuración

- **Query a tabla company_business_hours**: Consulta la tabla relacional en lugar del campo obsoleto `business_hours` TEXT
  ```typescript
  const { data: businessHours } = await supabase
    .from('company_business_hours')
    .select('*')
    .eq('company_id', company_id)
    .order('day_of_week', { ascending: true });
  ```

- **Actualización de mensajes**: Tanto `generateOrdenTrabajoFinalizadaMessage` como `generateOrdenCopiadoFinalizadaMessage` ahora incluyen:
  ```
  📍 *Retiro*: {ubicacion}
  🕐 *Horarios*: {horarios_formateados}
  ```

## Archivos Modificados

1. `/src/utils/timeUtils.ts` - Agregado debugging
2. `/supabase/functions/notify-orden-finalizada/index.ts` - Implementación completa de horarios

## Testing Requerido

### Tracking de Órdenes
1. Acceder a una URL de tracking (ej: `/tracking/{token}`)
2. Verificar en consola del navegador los logs que empiezan con 🕐
3. Confirmar que los horarios se muestren correctamente en la UI

### Notificaciones WhatsApp
1. Finalizar una orden de trabajo
2. Verificar que el mensaje de WhatsApp incluya:
   - Ubicación de retiro
   - Horarios formateados correctamente
3. Probar casos edge:
   - Sin horarios configurados → debe decir "Consultar horarios"
   - Días cerrados → no deben aparecer o decir "Cerrado"
   - Días consecutivos → deben agruparse (ej: "Lun-Vie")
   - Horarios divididos → formato "HH:MM-HH:MM y HH:MM-HH:MM"

## Casos de Prueba Específicos

1. **Sin horarios configurados**: Debe mostrar "Consultar horarios"
2. **Todos los días cerrados**: Debe mostrar "Consultar horarios"
3. **Horarios normales**: "Lun-Vie: 9:00-18:00"
4. **Horarios divididos**: "Lun-Vie: 9:00-12:00 y 15:00-19:00"
5. **Días mixtos**: "Lun-Vie: 9:00-18:00, Sáb: 9:00-13:00"

## Próximos Pasos

1. Desplegar los cambios al ambiente de producción
2. Ejecutar pruebas de tracking con órdenes reales
3. Generar una orden finalizada y verificar el mensaje de WhatsApp
4. Revisar logs en consola del navegador para tracking
5. Si persiste el problema en tracking, revisar que la empresa tenga horarios configurados en `company_business_hours`

## Notas Técnicas

- El SQL function `fn_get_public_order_tracking` ya devuelve correctamente los horarios desde la tabla `company_business_hours`
- Si el tracking sigue mostrando "Consultar horarios", es probable que la empresa no tenga horarios configurados en la base de datos
- Los horarios deben estar configurados en el módulo de perfil de empresa
- La función de edge function usa la misma lógica de agrupación y formateo que el frontend para mantener consistencia

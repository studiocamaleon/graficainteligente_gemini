# Corrección de Saldos de Cajas - Resumen Ejecutivo

## Fecha
3 de Diciembre, 2025

## Problema Detectado

Después de ejecutar la limpieza completa de la base de datos, se detectó que algunas cajas mantenían saldos positivos incorrectos:

| Caja | Saldo Incorrecto |
|------|------------------|
| Efectivo ARS | $25,000.00 |
| Mercado Pago | $139,487.97 |

**Total de saldos fantasma**: $164,487.97

## Análisis de Causa Raíz

### 1. Eliminación Parcial de Movimientos
La primera migración de limpieza (`20251203120000_limpiar_datos_prueba_completo.sql`) usó el siguiente filtro:

```sql
DELETE FROM cajas_movimientos
WHERE referencia_tipo IN ('pago', 'ingreso', 'egreso');
```

Este filtro **NO eliminó** movimientos con otros tipos de referencia:
- `pago_orden` (pagos de órdenes de trabajo)
- `pago_copiado` (pagos de centro de copiado)
- `ingreso_manual` (ingresos manuales registrados)

**Resultado**: Quedaron 11 movimientos huérfanos en la base de datos.

### 2. Trigger Solo en INSERT
El trigger original `actualizar_saldo_caja()` estaba configurado así:

```sql
CREATE TRIGGER trigger_actualizar_saldo_caja
  AFTER INSERT ON cajas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_caja();
```

**Problema**: El trigger solo se ejecuta al **insertar** movimientos, no al **eliminarlos**.

**Resultado**: Al eliminar movimientos, los saldos no se recalculaban automáticamente.

### 3. Movimientos Huérfanos Detectados

Query de análisis ejecutado:
```sql
SELECT
  tipo_movimiento,
  referencia_tipo,
  COUNT(*) as cantidad,
  SUM(monto) as total
FROM cajas_movimientos
GROUP BY tipo_movimiento, referencia_tipo;
```

**Resultados**:
| Tipo | Referencia | Cantidad | Total |
|------|-----------|----------|-------|
| egreso | pago_orden | 4 | $11,293.53 |
| ingreso | ingreso_manual | 1 | $13,000.00 |
| ingreso | pago_orden | 6 | $162,781.50 |

**Total**: 11 movimientos huérfanos que sumaban $164,487.97 netos

## Solución Implementada

### Migración: `20251202003659_fix_saldos_cajas_trigger_y_recalculo.sql`

#### Paso 1: Limpieza Total de Movimientos
```sql
TRUNCATE TABLE cajas_movimientos CASCADE;
```
Elimina **todos** los movimientos sin filtros, garantizando limpieza completa.

#### Paso 2: Reset de Saldos
```sql
UPDATE cajas
SET saldo_actual = 0
WHERE saldo_actual != 0;
```
Resetea todos los saldos a cero para comenzar de nuevo.

#### Paso 3: Nuevo Trigger para DELETE
```sql
CREATE OR REPLACE FUNCTION actualizar_saldo_caja_on_delete()
RETURNS TRIGGER AS $$
-- Lógica de recálculo al eliminar
$$;

CREATE TRIGGER trigger_actualizar_saldo_caja_on_delete
  AFTER DELETE ON cajas_movimientos
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_saldo_caja_on_delete();
```

Ahora el sistema recalcula saldos automáticamente en:
- ✅ **INSERT** (trigger original)
- ✅ **DELETE** (trigger nuevo)

## Verificación de Resultados

### Antes de la Corrección
```
Movimientos totales: 11
Cajas con saldo != 0: 2
Suma total de saldos: $164,487.97
```

### Después de la Corrección
```
Movimientos totales: 0
Cajas con saldo != 0: 0
Suma total de saldos: $0.00
```

✅ **Verificación exitosa - Sistema completamente limpio**

## Configuraciones Preservadas

La corrección respetó todas las configuraciones del sistema:

| Configuración | Registros |
|---------------|-----------|
| Usuarios (profiles) | 4 |
| Empresas | 2 |
| Cajas del Sistema | 12 |
| Medios de Cobro | 26 |
| Materiales | 13 |
| Tecnologías | 6 |
| Pasos de Producción | 41 |
| Rutas de Producción | 7 |
| Motivos de Pausa | 32 |
| Tipos de Ingreso | 7 |
| Tipos de Egreso | 10 |

## Mejoras Permanentes

### 1. Recálculo Automático Bidireccional
El sistema ahora mantiene los saldos sincronizados automáticamente:
- Al agregar movimientos → Recalcula saldo
- Al eliminar movimientos → Recalcula saldo

### 2. Prevención de Saldos Fantasma
Imposible que vuelva a ocurrir el mismo problema porque:
- Los triggers garantizan sincronización automática
- No depende de acciones manuales
- Funciona tanto para INSERT como DELETE

### 3. Integridad de Datos Mejorada
- Constraint `cajas_saldo_no_negativo` sigue activo
- Triggers actualizan ambas cajas en transferencias
- Cálculo considera todos los tipos de movimiento correctamente

## Impacto

### Antes
- ⚠️ Saldos incorrectos en cajas
- ⚠️ Riesgo de confusión con datos reales
- ⚠️ Posibles decisiones basadas en información incorrecta

### Después
- ✅ Sistema completamente limpio
- ✅ Saldos garantizados en cero
- ✅ Listo para comenzar con datos reales
- ✅ Triggers mejorados para prevenir futuros problemas

## Próximos Pasos Recomendados

1. ✅ **Validación completada** - El sistema está listo
2. **Comenzar ingreso de datos reales** - Crear primer cliente real
3. **Monitorear primeros movimientos** - Verificar que saldos se actualicen correctamente
4. **Establecer backup schedule** - Configurar backups automáticos
5. **Capacitar al equipo** - Informar que ahora trabajan con datos de producción

## Conclusión

El problema de saldos fantasma ha sido completamente resuelto. El sistema está ahora:

- ✅ Completamente limpio (0 datos transaccionales)
- ✅ Con todas las configuraciones preservadas
- ✅ Con triggers mejorados para prevenir problemas futuros
- ✅ Listo para comenzar operaciones con datos reales de producción

**Estado final**: Sistema listo para producción sin saldos fantasma ni movimientos huérfanos.

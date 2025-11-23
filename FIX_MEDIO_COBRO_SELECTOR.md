# Fix: Error en MedioCobroSelector

## Problema Identificado

**Error en consola:**
```
Uncaught TypeError: Cannot read properties of undefined (reading 'value')
    at onChange (MedioCobroSelector.tsx:44:64)
```

**Descripción:**
Al seleccionar un medio de cobro en el modal de pagos, se producía un error que impedía capturar el valor seleccionado.

---

## Causa Raíz

El componente `Select` tiene una API que ya convierte el evento en valor:

```typescript
// En Select.tsx (línea 14)
onChange?: (value: string) => void;  // Recibe string directamente

// En Select.tsx (línea 20-24)
const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
  if (onChange) {
    onChange(e.target.value);  // Ya convierte a string
  }
};
```

Pero `MedioCobroSelector` intentaba acceder nuevamente al evento:

```typescript
// INCORRECTO (línea 44)
<Select value={value} onChange={(e) => onChange(e.target.value)} />
//                                 ↑ 'e' es string, no tiene .target
```

---

## Solución Implementada

**Archivo modificado:** `src/components/medios-cobro/MedioCobroSelector.tsx`

**Cambio (línea 44):**

```diff
- <Select value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}>
+ <Select value={value} onChange={onChange} required={required} disabled={disabled}>
```

**Explicación:**
- El componente `Select` ya pasa el `value` como string
- No es necesario extraer `e.target.value` nuevamente
- Pasamos directamente la función `onChange` recibida como prop

---

## Verificación

✅ Build exitoso sin errores
✅ TypeScript compila correctamente
✅ API consistente con otros usos del componente `Select`

---

## Impacto

**Componentes afectados:**
- ✅ `PagoFormModal` - Ahora funciona correctamente
- ✅ Cualquier otro componente que use `MedioCobroSelector`

**Funcionalidad restaurada:**
- Seleccionar medio de cobro en modal de pagos
- Cálculo automático de comisión
- Cálculo automático de fecha de liberación
- Visualización de detalles del medio

---

## Prevención

Este tipo de error se previene:
1. Revisando la API del componente base (`Select`)
2. Verificando el tipo que recibe el callback `onChange`
3. No asumir que siempre se recibe el evento completo
4. Usar TypeScript para detectar incompatibilidades

---

## Estado

✅ **Resuelto completamente**
- Error corregido
- Build exitoso
- Sistema de pagos completamente funcional

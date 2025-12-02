/*
  # Documentación: Problema de pasos condicionales sin paso_id
  
  ## Problema Identificado
  Muchos pasos en rutas_produccion_pasos tienen paso_id = NULL, especialmente
  los pasos condicionales de tipo:
  - servicio_con_nivel
  - acabado_con_nivel
  - tecnologia_tinta
  
  ## Impacto
  - Solo se generan pasos obligatorios en las rutas de producción
  - Los pasos condicionales nunca se incluyen
  - Las órdenes convertidas desde presupuestos tienen rutas incompletas
  
  ## Causa
  Los pasos condicionales "con_nivel" están diseñados para usar mapeo_niveles,
  donde cada nivel del servicio/acabado mapea a un paso diferente.
  
  Ejemplo:
  {
    "servicio_id": "uuid-diseño",
    "mapeo_niveles": {
      "Basico": "paso_id_diseño_basico",
      "Intermedio": "paso_id_diseño_intermedio", 
      "Avanzado": "paso_id_diseño_avanzado"
    }
  }
  
  Pero en la práctica, muchas rutas tienen mapeo_niveles = {} vacío y paso_id = NULL.
  
  ## Solución Temporal Implementada
  La función fn_generar_ruta_produccion_item fue mejorada para:
  1. Saltar pasos con paso_id = NULL (no configurados)
  2. Cuando mapeo_niveles está vacío, incluir el paso si servicio/acabado coincide
     (pero esto requiere que paso_id no sea NULL)
  
  ## Solución Definitiva Requerida
  Se necesita uno de estos enfoques:
  
  ### Opción A: Interfaz de configuración de rutas
  Cuando se crea un paso condicional "con_nivel":
  - Si se va a usar mapeo por niveles, permitir configurar mapeo_niveles
  - Si NO se usa mapeo, requerir seleccionar un paso_id por defecto
  - NO permitir guardar con paso_id = NULL y mapeo_niveles = {}
  
  ### Opción B: Migración de datos
  Para cada paso con paso_id = NULL:
  - Si tipo_condicion = 'servicio_con_nivel', buscar el servicio y asignar
    un paso por defecto (ej: nivel Basico)
  - Si tipo_condicion = 'acabado_con_nivel', similar
  - Si tipo_condicion = 'tecnologia_tinta', asignar el paso de impresión
    correspondiente a la tecnología
  
  ## Estadísticas Actuales
  Rutas con problemas:
  - Carpetas con solapa: 5/8 pasos sin ID
  - Impresion laser Estandar: 5/8 pasos sin ID
  - Vinilo impreso: 4/6 pasos sin ID
  - Table Tent: 4/6 pasos sin ID
  - Talonarios: 2/4 pasos sin ID
  - Materiales Rigidos: 1/2 pasos sin ID
  
  ## Acción Inmediata Recomendada
  1. Revisar configuración de rutas en la interfaz
  2. Para cada paso condicional, asignar paso_id correcto
  3. Configurar mapeo_niveles si se necesitan pasos diferentes por nivel
  4. Regenerar rutas de órdenes existentes con rutas incompletas
*/

-- Esta migración es solo documentación, no hace cambios en la BD
-- Los cambios deben hacerse desde la interfaz de configuración de rutas

SELECT 'Documentación agregada. Ver comentarios en la migración.' as mensaje;

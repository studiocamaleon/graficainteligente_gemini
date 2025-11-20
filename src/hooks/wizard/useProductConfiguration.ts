import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProductCategory } from './useUniversalProductSearch';

export interface ProductConfiguration {
  // Datos básicos del producto
  id: string;
  nombre: string;
  categoria: ProductCategory;

  // Medidas disponibles
  medidas?: { ancho: number; alto: number }[];
  tipo_medida?: 'medida_unica' | 'medidas_multiples' | 'ancho_maximo' | 'sin_medida';
  anchos_disponibles?: number[];

  // Cantidad
  tipo_venta?: 'unidad' | 'cantidades_fijas';
  cantidades_fijas?: number[];
  cantidad_minima?: number;

  // Material y variantes
  materiales?: Array<{
    id: string;
    material_id: string;
    material_nombre: string;
    variante_id: string;
    variante_nombre: string;
    espesor?: number;
    unidad_espesor?: string;
    gramaje?: number;
  }>;

  // Tecnologías y tintas (para productos con impresión)
  tecnologias?: Array<{
    id: string;
    tecnologia_id: string;
    tecnologia_nombre: string;
    tintas: string[];
  }>;

  // Caras de impresión (para laser)
  caras_impresas?: string[];

  // Espesores (para materiales rígidos)
  espesores_disponibles?: number[];

  // Color y marca (para plotter y sellos)
  color?: string;
  marca?: string;

  // Servicios disponibles
  servicios: Array<{
    id: string;
    servicio_id: string;
    servicio_nombre: string;
    tiene_niveles: boolean;
    niveles?: Array<{
      id: string;
      nombre: string;
      tipo_impacto: string;
      valor_porcentaje: number | null;
      valor_monto: number | null;
    }>;
  }>;

  // Acabados disponibles
  acabados: Array<{
    id: string;
    acabado_id: string;
    acabado_nombre: string;
    tiene_niveles: boolean;
    niveles?: Array<{
      id: string;
      nombre: string;
      tipo_impacto: string;
      valor_porcentaje: number | null;
      valor_monto: number | null;
    }>;
  }>;

  // Impuesto
  impuesto_iva: number;
}

export function useProductConfiguration(productId: string | null, categoria: ProductCategory | null) {
  const [config, setConfig] = useState<ProductConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId || !categoria) {
      setConfig(null);
      return;
    }

    const loadConfiguration = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let configuration: ProductConfiguration | null = null;

        switch (categoria) {
          case 'Impresion Laser':
            configuration = await loadImpresionLaserConfig(productId);
            break;
          case 'Impresion Gran Formato':
            configuration = await loadGranFormatoConfig(productId);
            break;
          case 'Materiales Rigidos':
            configuration = await loadMaterialesRigidosConfig(productId);
            break;
          case 'Plotter de Corte':
            configuration = await loadPlotterCorteConfig(productId);
            break;
          case 'Portabanners':
            configuration = await loadPortabannersConfig(productId);
            break;
          case 'Sellos':
            configuration = await loadSellosConfig(productId);
            break;
        }

        setConfig(configuration);
      } catch (err) {
        console.error('Error cargando configuración:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setConfig(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfiguration();
  }, [productId, categoria]);

  return { config, isLoading, error };
}

// ===============================================
// FUNCIONES DE CARGA POR CATEGORÍA
// ===============================================

async function loadImpresionLaserConfig(productId: string): Promise<ProductConfiguration> {
  // Cargar datos básicos
  const { data: producto, error: prodError } = await supabase
    .from('productos_impresion_laser')
    .select('id, nombre, tipo_venta, cantidades_fijas, caras_impresas, medidas_disponibles, impuesto_iva')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  // Cargar materiales con el campo variantes (JSONB) de la tabla materiales
  const { data: materiales } = await supabase
    .from('productos_impresion_laser_materiales')
    .select(`
      id,
      material_id,
      variante_nombre,
      espesor,
      materiales!inner(id, nombre, unidad_espesor, variantes)
    `)
    .eq('producto_laser_id', productId);

  // Cargar tecnologías
  const { data: tecnologias } = await supabase
    .from('productos_impresion_laser_tecnologias')
    .select(`
      id,
      tecnologia_id,
      tintas,
      tecnologias!inner(id, nombre)
    `)
    .eq('producto_laser_id', productId);

  // Cargar servicios
  const servicios = await loadServiciosForProduct(
    'productos_impresion_laser_servicios',
    'producto_laser_id',
    productId
  );

  // Cargar acabados
  const acabados = await loadAcabadosForProduct(
    'productos_impresion_laser_acabados',
    'producto_laser_id',
    productId
  );

  // Procesar medidas
  const medidasArray = producto.medidas_disponibles as any[];
  const medidas = medidasArray?.map((m: any) => ({
    ancho: m.ancho,
    alto: m.alto
  })) || [];

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Impresion Laser',
    medidas,
    tipo_venta: producto.tipo_venta as 'unidad' | 'cantidades_fijas',
    cantidades_fijas: producto.cantidades_fijas || [],
    caras_impresas: producto.caras_impresas || [],
    materiales: materiales?.map(m => {
      const material = m.materiales as any;

      // IMPORTANTE: El campo "espesor" en productos_impresion_laser_materiales
      // contiene el valor numérico (sea espesor o gramaje).
      // El campo "unidad_espesor" de la tabla materiales define la unidad (mm, gr, etc).
      // Se debe mantener el espesor tal como está en la BD y la unidad_espesor del material.

      return {
        id: m.id,
        material_id: m.material_id,
        material_nombre: material.nombre,
        variante_id: m.material_id,
        variante_nombre: m.variante_nombre,
        espesor: m.espesor ? parseFloat(m.espesor) : null,
        unidad_espesor: material.unidad_espesor,
        gramaje: null // Se determina en el renderizado según unidad_espesor
      };
    }) || [],
    tecnologias: tecnologias?.map(t => ({
      id: t.id,
      tecnologia_id: t.tecnologia_id,
      tecnologia_nombre: (t.tecnologias as any).nombre,
      tintas: t.tintas || []
    })) || [],
    servicios,
    acabados,
    impuesto_iva: producto.impuesto_iva || 0
  };
}

async function loadGranFormatoConfig(productId: string): Promise<ProductConfiguration> {
  const { data: producto, error: prodError } = await supabase
    .from('productos_gran_formato')
    .select('id, nombre, tipo_venta, cantidad_minima, tipo_medida, anchos_disponibles, impuesto_iva')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  // Cargar materiales
  const { data: materiales } = await supabase
    .from('productos_gran_formato_materiales')
    .select(`
      id,
      material_id,
      variante_nombre,
      materiales!inner(id, nombre)
    `)
    .eq('producto_gran_formato_id', productId);

  // Cargar tecnologías
  const { data: tecnologias } = await supabase
    .from('productos_gran_formato_tecnologias')
    .select(`
      id,
      tecnologia_id,
      tintas,
      tecnologias!inner(id, nombre)
    `)
    .eq('producto_gran_formato_id', productId);

  const servicios = await loadServiciosForProduct(
    'productos_gran_formato_servicios',
    'producto_gran_formato_id',
    productId
  );

  const acabados = await loadAcabadosForProduct(
    'productos_gran_formato_acabados',
    'producto_gran_formato_id',
    productId
  );

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Impresion Gran Formato',
    tipo_medida: producto.tipo_medida,
    anchos_disponibles: producto.anchos_disponibles || [],
    tipo_venta: 'unidad',
    cantidad_minima: producto.cantidad_minima,
    materiales: materiales?.map(m => ({
      id: m.id,
      material_id: m.material_id,
      material_nombre: (m.materiales as any).nombre,
      variante_id: m.material_id,
      variante_nombre: m.variante_nombre
    })) || [],
    tecnologias: tecnologias?.map(t => ({
      id: t.id,
      tecnologia_id: t.tecnologia_id,
      tecnologia_nombre: (t.tecnologias as any).nombre,
      tintas: t.tintas || []
    })) || [],
    servicios,
    acabados,
    impuesto_iva: producto.impuesto_iva || 0
  };
}

async function loadMaterialesRigidosConfig(productId: string): Promise<ProductConfiguration> {
  const { data: producto, error: prodError } = await supabase
    .from('productos_materiales_rigidos')
    .select('id, nombre, tipo_venta, cantidad_minima, tipo_medida, impuesto_iva')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  // Cargar materiales con variantes
  const { data: materiales } = await supabase
    .from('productos_materiales_rigidos_materiales')
    .select(`
      id,
      material_id,
      variante_id,
      espesor,
      materiales!inner(id, nombre, unidad_espesor),
      variantes:material_variantes!inner(id, nombre)
    `)
    .eq('producto_materiales_rigidos_id', productId);

  const servicios = await loadServiciosForProduct(
    'productos_materiales_rigidos_servicios',
    'producto_materiales_rigidos_id',
    productId
  );

  const acabados = await loadAcabadosForProduct(
    'productos_materiales_rigidos_acabados',
    'producto_materiales_rigidos_id',
    productId
  );

  // Extraer espesores únicos
  const espesores = [...new Set(materiales?.map(m => m.espesor).filter(e => e != null) as number[])]
    .sort((a, b) => a - b);

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Materiales Rigidos',
    tipo_medida: producto.tipo_medida,
    tipo_venta: producto.tipo_venta as 'unidad' | 'cantidades_fijas',
    cantidad_minima: producto.cantidad_minima,
    espesores_disponibles: espesores,
    materiales: materiales?.map(m => ({
      id: m.id,
      material_id: m.material_id,
      material_nombre: (m.materiales as any).nombre,
      variante_id: m.variante_id,
      variante_nombre: (m.variantes as any).nombre,
      espesor: m.espesor,
      unidad_espesor: (m.materiales as any).unidad_espesor
    })) || [],
    servicios,
    acabados,
    impuesto_iva: producto.impuesto_iva || 0
  };
}

async function loadPlotterCorteConfig(productId: string): Promise<ProductConfiguration> {
  const { data: producto, error: prodError } = await supabase
    .from('productos_plotter_corte')
    .select('id, nombre, tipo_medida, anchos_disponibles, color, marca, cantidad_minima')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  const servicios = await loadServiciosForProduct(
    'productos_plotter_corte_servicios',
    'producto_id',
    productId
  );

  const acabados = await loadAcabadosForProduct(
    'productos_plotter_corte_acabados',
    'producto_id',
    productId
  );

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Plotter de Corte',
    tipo_medida: producto.tipo_medida,
    anchos_disponibles: producto.anchos_disponibles || [],
    cantidad_minima: producto.cantidad_minima,
    color: producto.color,
    marca: producto.marca,
    servicios,
    acabados,
    impuesto_iva: 0
  };
}

async function loadPortabannersConfig(productId: string): Promise<ProductConfiguration> {
  const { data: producto, error: prodError } = await supabase
    .from('productos_portabanners')
    .select('id, nombre, medida_ancho, medida_alto, cantidad_minima')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  // Cargar tecnologías
  const { data: tecnologias } = await supabase
    .from('productos_portabanners_tecnologias')
    .select(`
      id,
      tecnologia_id,
      tecnologias!inner(id, nombre)
    `)
    .eq('producto_id', productId);

  const servicios = await loadServiciosForProduct(
    'productos_portabanners_servicios',
    'producto_id',
    productId
  );

  const acabados = await loadAcabadosForProduct(
    'productos_portabanners_acabados',
    'producto_id',
    productId
  );

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Portabanners',
    medidas: [{ ancho: producto.medida_ancho, alto: producto.medida_alto }],
    cantidad_minima: producto.cantidad_minima,
    tecnologias: tecnologias?.map(t => ({
      id: t.id,
      tecnologia_id: t.tecnologia_id,
      tecnologia_nombre: (t.tecnologias as any).nombre,
      tintas: []
    })) || [],
    servicios,
    acabados,
    impuesto_iva: 0
  };
}

async function loadSellosConfig(productId: string): Promise<ProductConfiguration> {
  const { data: producto, error: prodError } = await supabase
    .from('productos_sellos')
    .select('id, nombre, medida_ancho, medida_alto, marca, impuesto_iva')
    .eq('id', productId)
    .single();

  if (prodError) throw prodError;

  return {
    id: producto.id,
    nombre: producto.nombre,
    categoria: 'Sellos',
    medidas: [{ ancho: producto.medida_ancho, alto: producto.medida_alto }],
    marca: producto.marca,
    servicios: [],
    acabados: [],
    impuesto_iva: producto.impuesto_iva || 0
  };
}

// ===============================================
// FUNCIONES AUXILIARES
// ===============================================

async function loadServiciosForProduct(
  tabla: string,
  foreignKey: string,
  productId: string
) {
  const { data: relaciones } = await supabase
    .from(tabla)
    .select(`
      id,
      servicio_id,
      servicios!inner(id, nombre, tiene_niveles_precio)
    `)
    .eq(foreignKey, productId);

  if (!relaciones) return [];

  const serviciosWithNiveles = await Promise.all(
    relaciones.map(async (rel: any) => {
      const servicio = rel.servicios;
      let niveles = [];

      if (servicio.tiene_niveles_precio) {
        const { data: nivelesData } = await supabase
          .from('servicios_niveles_precio')
          .select('id, nombre, tipo_impacto, valor_impacto, valor_impacto_secundario')
          .eq('servicio_id', rel.servicio_id)
          .order('orden');

        niveles = nivelesData?.map(n => {
          // Mapear valores según el tipo de impacto
          let valor_monto = null;
          let valor_porcentaje = null;

          switch (n.tipo_impacto) {
            case 'precio_fijo':
            case 'por_unidad':
            case 'por_mt2':
            case 'por_metro_lineal':
              valor_monto = n.valor_impacto;
              break;

            case 'porcentual':
              valor_porcentaje = n.valor_impacto;
              break;

            case 'fijo_porcentual':
              valor_monto = n.valor_impacto;
              valor_porcentaje = n.valor_impacto_secundario;
              break;

            case 'fijo_metro_cuadrado':
            case 'fijo_metro_lineal':
            case 'fijo_por_minuto':
              valor_monto = n.valor_impacto;
              valor_porcentaje = n.valor_impacto_secundario;
              break;

            case 'por_minuto':
              valor_monto = n.valor_impacto;
              break;
          }

          return {
            id: n.id,
            nombre: n.nombre,
            tipo_impacto: n.tipo_impacto,
            valor_porcentaje,
            valor_monto
          };
        }) || [];
      }

      return {
        id: rel.id,
        servicio_id: rel.servicio_id,
        servicio_nombre: servicio.nombre,
        tiene_niveles: servicio.tiene_niveles_precio,
        niveles
      };
    })
  );

  return serviciosWithNiveles;
}

async function loadAcabadosForProduct(
  tabla: string,
  foreignKey: string,
  productId: string
) {
  const { data: relaciones } = await supabase
    .from(tabla)
    .select(`
      id,
      acabado_id,
      acabados!inner(id, nombre, tiene_niveles_precio)
    `)
    .eq(foreignKey, productId);

  if (!relaciones) return [];

  const acabadosWithNiveles = await Promise.all(
    relaciones.map(async (rel: any) => {
      const acabado = rel.acabados;
      let niveles = [];

      if (acabado.tiene_niveles_precio) {
        const { data: nivelesData } = await supabase
          .from('acabados_niveles_precio')
          .select('id, nombre, tipo_impacto, valor_impacto, valor_impacto_secundario')
          .eq('acabado_id', rel.acabado_id)
          .order('orden');

        niveles = nivelesData?.map(n => {
          // Mapear valores según el tipo de impacto
          let valor_monto = null;
          let valor_porcentaje = null;

          switch (n.tipo_impacto) {
            case 'precio_fijo':
            case 'por_unidad':
            case 'por_mt2':
            case 'por_metro_lineal':
              valor_monto = n.valor_impacto;
              break;

            case 'porcentual':
              valor_porcentaje = n.valor_impacto;
              break;

            case 'fijo_porcentual':
              valor_monto = n.valor_impacto;
              valor_porcentaje = n.valor_impacto_secundario;
              break;

            case 'fijo_metro_cuadrado':
            case 'fijo_metro_lineal':
            case 'fijo_por_minuto':
              valor_monto = n.valor_impacto;
              valor_porcentaje = n.valor_impacto_secundario;
              break;

            case 'por_minuto':
              valor_monto = n.valor_impacto;
              break;
          }

          return {
            id: n.id,
            nombre: n.nombre,
            tipo_impacto: n.tipo_impacto,
            valor_porcentaje,
            valor_monto
          };
        }) || [];
      }

      return {
        id: rel.id,
        acabado_id: rel.acabado_id,
        acabado_nombre: acabado.nombre,
        tiene_niveles: acabado.tiene_niveles_precio,
        niveles
      };
    })
  );

  return acabadosWithNiveles;
}

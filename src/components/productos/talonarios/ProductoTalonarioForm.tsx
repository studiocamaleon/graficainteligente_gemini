import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { MedidasEditor, type Medida } from '../impresion-laser/MedidasEditor';
import { TecnologiaTintasSelector } from '../impresion-laser/TecnologiaTintasSelector';
import { TipoCopiaSelector } from './TipoCopiaSelector';
import { MaterialCascadeSelector } from '../impresion-laser/MaterialCascadeSelector';
import { TipoVentaSelector } from '../impresion-laser/TipoVentaSelector';
import { ServiciosSelector } from '../shared/ServiciosSelector';
import { CATEGORIA_TALONARIOS_ID } from '../../../constants/categorias';
import { AcabadosSelector } from '../shared/AcabadosSelector';
import { ImpuestoSelector } from '../impresion-laser/ImpuestoSelector';
import { RutaSelector } from '../../rutas/RutaSelector';
import type { CreateProductoTalonarioData, ProductoTalonarioConRelaciones } from '../../../hooks/useProductosTalonarios';

interface ProductoTalonarioFormProps {
  producto?: ProductoTalonarioConRelaciones;
  onSubmit: (data: CreateProductoTalonarioData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  onFormChange?: () => void;
}

interface FormErrors {
  nombre?: string;
  medidas?: string;
  tintas?: string;
  tiposCopia?: string;
  materialId?: string;
  varianteNombre?: string;
  espesor?: string;
  tipoVenta?: string;
  cantidadesFijas?: string;
  impuesto?: string;
}

export function ProductoTalonarioForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
  onFormChange,
}: ProductoTalonarioFormProps) {
  const [nombre, setNombre] = useState('');
  const [medidas, setMedidas] = useState<Medida[]>([]);
  const [tecnologiaId, setTecnologiaId] = useState('');
  const [tintas, setTintas] = useState<string[]>([]);
  const [tiposCopia, setTiposCopia] = useState<string[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [varianteNombre, setVarianteNombre] = useState('');
  const [espesor, setEspesor] = useState<number | undefined>(undefined);
  const [tipoVenta, setTipoVenta] = useState<'unidades' | 'cantidades_fijas'>('unidades');
  const [cantidadesFijas, setCantidadesFijas] = useState<number[]>([]);
  const [servicios, setServicios] = useState<string[]>([]);
  const [acabados, setAcabados] = useState<string[]>([]);
  const [impuesto, setImpuesto] = useState(21);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setMedidas(producto.medidas_disponibles);
      setTiposCopia(producto.tipo_copia);
      setTipoVenta(producto.tipo_venta);
      setCantidadesFijas(producto.cantidades_fijas);
      setImpuesto(producto.impuesto_iva);
      setRutaProduccionId(producto.ruta_produccion_id || '');

      if (producto.tecnologias.length > 0) {
        setTecnologiaId(producto.tecnologias[0].tecnologia_id);
        setTintas(producto.tecnologias[0].tintas);
      }

      if (producto.materiales.length > 0) {
        setMaterialId(producto.materiales[0].material_id);
        setVarianteNombre(producto.materiales[0].variante_nombre);
        setEspesor(producto.materiales[0].espesor || undefined);
      }

      setServicios(producto.servicios.map((s) => s.servicio_id));
      setAcabados(producto.acabados.map((a) => a.acabado_id));
    }
  }, [producto]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    } else if (nombre.length < 3) {
      newErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (medidas.length === 0) {
      newErrors.medidas = 'Debe agregar al menos una medida';
    } else {
      const medidasInvalidas = medidas.some((m) => m.ancho <= 0 || m.alto <= 0);
      if (medidasInvalidas) {
        newErrors.medidas = 'Todas las medidas deben tener ancho y alto mayores a 0';
      }
    }

    if (!tecnologiaId) {
      newErrors.tintas = 'No se pudo cargar la tecnología de Impresión Láser';
    } else if (tintas.length === 0) {
      newErrors.tintas = 'Debe seleccionar al menos una tinta';
    }

    if (tiposCopia.length === 0) {
      newErrors.tiposCopia = 'Debe seleccionar al menos un tipo de copia';
    }

    if (!materialId) {
      newErrors.materialId = 'Debe seleccionar un material';
    }

    if (materialId && !varianteNombre) {
      newErrors.varianteNombre = 'Debe seleccionar una variante';
    }

    if (tipoVenta === 'cantidades_fijas' && cantidadesFijas.length === 0) {
      newErrors.cantidadesFijas = 'Debe agregar al menos una cantidad';
    }

    if (!impuesto) {
      newErrors.impuesto = 'Debe seleccionar un impuesto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('=== FORMULARIO PRODUCTO LASER - SUBMIT ===');
    console.log('Tecnología ID:', tecnologiaId);
    console.log('Tintas seleccionadas:', tintas);
    console.log('Material ID:', materialId);
    console.log('Variante:', varianteNombre);
    console.log('Espesor:', espesor);

    if (!validateForm()) {
      console.error('❌ Validación del formulario falló');
      return;
    }

    const data: CreateProductoTalonarioData = {
      nombre: nombre.trim(),
      medidas_disponibles: medidas,
      tipo_copia: tiposCopia,
      producto_impreso: true,
      tipo_venta: tipoVenta,
      cantidades_fijas: tipoVenta === 'cantidades_fijas' ? cantidadesFijas : [],
      impuesto_iva: impuesto,
      ruta_produccion_id: rutaProduccionId || undefined,
      tecnologia_id: tecnologiaId,
      tintas,
      material_id: materialId,
      variante_nombre: varianteNombre,
      espesor,
      servicios,
      acabados,
    };

    console.log('✅ Datos del formulario validados:', data);
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Información Básica</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del Producto
              <span className="text-red-500 ml-1">*</span>
            </label>
            <Input
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                onFormChange?.();
              }}
              placeholder="Ej: Tarjetas Personales"
              maxLength={100}
            />
            {errors.nombre && (
              <p className="text-sm text-red-600 mt-1">{errors.nombre}</p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MedidasEditor
            medidas={medidas}
            onChange={(m) => {
              setMedidas(m);
              onFormChange?.();
            }}
            error={errors.medidas}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TecnologiaTintasSelector
            tintasSeleccionadas={tintas}
            onTintasChange={(t) => {
              setTintas(t);
              onFormChange?.();
            }}
            onTecnologiaChange={(id) => {
              setTecnologiaId(id);
              onFormChange?.();
            }}
            error={errors.tintas}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TipoCopiaSelector
            tiposSeleccionados={tiposCopia}
            onChange={(c) => {
              setTiposCopia(c);
              onFormChange?.();
            }}
            error={errors.tiposCopia}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MaterialCascadeSelector
            materialId={materialId}
            varianteNombre={varianteNombre}
            espesor={espesor}
            onMaterialChange={(id) => {
              setMaterialId(id);
              onFormChange?.();
            }}
            onVarianteChange={(v) => {
              setVarianteNombre(v);
              onFormChange?.();
            }}
            onEspesorChange={(e) => {
              setEspesor(e);
              onFormChange?.();
            }}
            errors={{
              materialId: errors.materialId,
              varianteNombre: errors.varianteNombre,
              espesor: errors.espesor,
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TipoVentaSelector
            tipoVenta={tipoVenta}
            cantidadesFijas={cantidadesFijas}
            onTipoVentaChange={(t) => {
              setTipoVenta(t);
              onFormChange?.();
            }}
            onCantidadesFijasChange={(c) => {
              setCantidadesFijas(c);
              onFormChange?.();
            }}
            errors={{
              tipoVenta: errors.tipoVenta,
              cantidadesFijas: errors.cantidadesFijas,
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ServiciosSelector
            categoriaId={CATEGORIA_TALONARIOS_ID}
            serviciosSeleccionados={servicios}
            onChange={(s) => {
              setServicios(s);
              onFormChange?.();
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <AcabadosSelector
            categoriaId={CATEGORIA_TALONARIOS_ID}
            acabadosSeleccionados={acabados}
            onChange={(a) => {
              setAcabados(a);
              onFormChange?.();
            }}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ImpuestoSelector
            impuesto={impuesto}
            onChange={(i) => {
              setImpuesto(i);
              onFormChange?.();
            }}
            error={errors.impuesto}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Ruta de Producción</h3>
            <p className="text-sm text-gray-600 mb-4">
              Asigna una ruta de producción predefinida que determinará los pasos del flujo de trabajo para este producto.
            </p>
          </div>
          <RutaSelector
            value={rutaProduccionId}
            onChange={(rutaId) => {
              setRutaProduccionId(rutaId);
              onFormChange?.();
            }}
            showDescription={true}
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500">
            La ruta de producción es opcional. Si no se asigna ninguna, se deberá configurar manualmente la ruta al crear órdenes de trabajo.
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : producto ? 'Actualizar' : 'Crear Producto'}
        </Button>
      </div>
    </form>
  );
}

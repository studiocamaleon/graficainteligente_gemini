import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { AnchosDisponiblesPlotterSelector } from './AnchosDisponiblesPlotterSelector';
import { CantidadMinimaInputPlotter } from './CantidadMinimaInputPlotter';
import { ColorPlotterSelector } from './ColorPlotterSelector';
import { MarcaPlotterSelector } from './MarcaPlotterSelector';
import { MaterialCascadeSelector } from '../impresion-laser/MaterialCascadeSelector';
import { ServiciosSelectorPlotterCorte } from './ServiciosSelectorPlotterCorte';
import { AcabadosSelectorPlotterCorte } from './AcabadosSelectorPlotterCorte';
import { ImpuestoSelector } from '../impresion-laser/ImpuestoSelector';
import { RangoPrecioSelectorPlotterCorte } from './RangoPrecioSelectorPlotterCorte';
import { RutaSelector } from '../../rutas/RutaSelector';
import type {
  CreateProductoPlotterCorteData,
  ProductoPlotterCorteConRelaciones,
  ColorPlotter,
  MarcaPlotter,
} from '../../../types/database';

interface ProductoPlotterCorteFormProps {
  producto?: ProductoPlotterCorteConRelaciones;
  onSubmit: (data: CreateProductoPlotterCorteData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  onFormChange?: () => void;
}

interface FormErrors {
  nombre?: string;
  anchos?: string;
  materialId?: string;
  varianteNombre?: string;
  espesor?: string;
  color?: string;
  impuesto?: string;
}

export function ProductoPlotterCorteForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
  onFormChange,
}: ProductoPlotterCorteFormProps) {
  const [nombre, setNombre] = useState('');
  const [anchosDisponibles, setAnchosDisponibles] = useState<number[]>([]);
  const [cantidadMinima, setCantidadMinima] = useState<number | undefined>(undefined);
  const [materialId, setMaterialId] = useState('');
  const [varianteNombre, setVarianteNombre] = useState('');
  const [espesor, setEspesor] = useState<number | undefined>(undefined);
  const [color, setColor] = useState<ColorPlotter>('Blanco o Negro');
  const [marca, setMarca] = useState<MarcaPlotter | null>(null);
  const [servicios, setServicios] = useState<string[]>([]);
  const [acabados, setAcabados] = useState<string[]>([]);
  const [impuesto, setImpuesto] = useState(21);
  const [rangoPrecioId, setRangoPrecioId] = useState<string | undefined>(undefined);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setAnchosDisponibles(producto.anchos_disponibles || []);
      setCantidadMinima(producto.cantidad_minima || undefined);
      setMaterialId(producto.material_id);
      setVarianteNombre(producto.variante_nombre);
      setEspesor(producto.espesor || undefined);
      setColor(producto.color);
      setMarca(producto.marca);
      setImpuesto(producto.impuesto_iva);
      setRangoPrecioId(producto.rango_precio_id || undefined);
      setRutaProduccionId(producto.ruta_produccion_id || '');
      setServicios(producto.servicios.map((s) => s.servicio_id));
      setAcabados(producto.acabados.map((a) => a.acabado_id));
    }
  }, [producto]);

  useEffect(() => {
    if (onFormChange) {
      onFormChange();
    }
  }, [
    nombre,
    anchosDisponibles,
    cantidadMinima,
    materialId,
    varianteNombre,
    espesor,
    color,
    marca,
    servicios,
    acabados,
    impuesto,
    rangoPrecioId,
    rutaProduccionId,
  ]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    } else if (nombre.length < 3) {
      newErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (anchosDisponibles.length === 0) {
      newErrors.anchos = 'Debe seleccionar al menos un ancho disponible';
    }

    if (!materialId) {
      newErrors.materialId = 'Debe seleccionar un material';
    }

    if (materialId && !varianteNombre) {
      newErrors.varianteNombre = 'Debe seleccionar una variante';
    }

    if (!color) {
      newErrors.color = 'Debe seleccionar un color';
    }

    if (!impuesto) {
      newErrors.impuesto = 'Debe seleccionar un impuesto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const data: CreateProductoPlotterCorteData = {
      nombre: nombre.trim(),
      anchos_disponibles: anchosDisponibles,
      cantidad_minima: cantidadMinima,
      material_id: materialId,
      variante_nombre: varianteNombre,
      espesor,
      color,
      marca,
      impuesto_iva: impuesto,
      rango_precio_id: rangoPrecioId,
      ruta_produccion_id: rutaProduccionId || undefined,
      servicios,
      acabados,
    };

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
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Vinilo para Plotter"
              maxLength={100}
            />
            {errors.nombre && <p className="text-sm text-red-600 mt-1">{errors.nombre}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Unidad de Venta</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <span className="font-semibold">Unidad de venta fija:</span> Metro Lineal
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Los productos de plotter de corte siempre se venden por metro lineal
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MaterialCascadeSelector
            materialId={materialId}
            varianteNombre={varianteNombre}
            espesor={espesor}
            onMaterialChange={setMaterialId}
            onVarianteChange={setVarianteNombre}
            onEspesorChange={setEspesor}
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
          <AnchosDisponiblesPlotterSelector
            anchosSeleccionados={anchosDisponibles}
            onChange={setAnchosDisponibles}
            error={errors.anchos}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <CantidadMinimaInputPlotter value={cantidadMinima} onChange={setCantidadMinima} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ColorPlotterSelector value={color} onChange={setColor} error={errors.color} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MarcaPlotterSelector value={marca} onChange={setMarca} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ServiciosSelectorPlotterCorte serviciosSeleccionados={servicios} onChange={setServicios} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <AcabadosSelectorPlotterCorte acabadosSeleccionados={acabados} onChange={setAcabados} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <RangoPrecioSelectorPlotterCorte rangoSeleccionado={rangoPrecioId} onChange={setRangoPrecioId} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ImpuestoSelector impuesto={impuesto} onChange={setImpuesto} error={errors.impuesto} />
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
            onChange={(rutaId) => setRutaProduccionId(rutaId)}
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

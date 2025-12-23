import { useState, useEffect, useRef } from 'react';
import { Card } from '../../ui/card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { TipoVentaGranFormatoSelector } from './TipoVentaGranFormatoSelector';
import { AnchosDisponiblesSelector } from './AnchosDisponiblesSelector';
import { CantidadMinimaInput } from './CantidadMinimaInput';
import { TecnologiasGranFormatoSelector } from './TecnologiasGranFormatoSelector';
import { TintasPorTecnologiaSelector } from './TintasPorTecnologiaSelector';
import { MaterialCascadeSelector } from '../impresion-laser/MaterialCascadeSelector';
import { ServiciosSelectorGranFormato } from './ServiciosSelectorGranFormato';
import { AcabadosSelectorGranFormato } from './AcabadosSelectorGranFormato';
import { ImpuestoSelector } from '../impresion-laser/ImpuestoSelector';
import { RangoPrecioSelector } from './RangoPrecioSelector';
import { RutaSelector } from '../../rutas/RutaSelector';
import type {
  CreateProductoGranFormatoData,
  ProductoGranFormatoConRelaciones,
  TipoVenta,
  TecnologiaTintasData,
} from '../../../types/database';

interface ProductoGranFormatoFormProps {
  producto?: ProductoGranFormatoConRelaciones;
  onSubmit: (data: CreateProductoGranFormatoData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  onFormChange?: () => void;
}

interface FormErrors {
  nombre?: string;
  tipoVenta?: string;
  anchos?: string;
  tecnologias?: string;
  tintas?: Record<string, string>;
  materialId?: string;
  varianteNombre?: string;
  espesor?: string;
  impuesto?: string;
}

export function ProductoGranFormatoForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
  onFormChange,
}: ProductoGranFormatoFormProps) {
  const [nombre, setNombre] = useState('');
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>('mt2');
  const [anchosDisponibles, setAnchosDisponibles] = useState<number[]>([]);
  const [cantidadMinima, setCantidadMinima] = useState<number | undefined>(undefined);
  const [tecnologiasSeleccionadas, setTecnologiasSeleccionadas] = useState<string[]>([]);
  const [tecnologiasTintas, setTecnologiasTintas] = useState<TecnologiaTintasData[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [varianteNombre, setVarianteNombre] = useState('');
  const [espesor, setEspesor] = useState<number | undefined>(undefined);
  const [servicios, setServicios] = useState<string[]>([]);
  const [acabados, setAcabados] = useState<string[]>([]);
  const [impuesto, setImpuesto] = useState(21);
  const [rangoPrecioId, setRangoPrecioId] = useState<string | undefined>(undefined);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (producto) {
      isInitializingRef.current = true;

      setNombre(producto.nombre);
      setTipoVenta(producto.tipo_venta);
      setAnchosDisponibles(producto.anchos_disponibles || []);
      setImpuesto(producto.impuesto_iva);
      setRangoPrecioId(producto.rango_precio_id || undefined);
      setCantidadMinima(producto.cantidad_minima || undefined);
      setRutaProduccionId(producto.ruta_produccion_id || '');

      if (producto.tecnologias.length > 0) {
        const tecIds = producto.tecnologias.map((t) => t.tecnologia_id);
        const tecTintas = producto.tecnologias.map((t) => ({
          tecnologia_id: t.tecnologia_id,
          tintas: t.tintas || [],
        }));

        setTecnologiasSeleccionadas(tecIds);
        setTecnologiasTintas(tecTintas);
      }

      if (producto.materiales.length > 0) {
        setMaterialId(producto.materiales[0].material_id);
        setVarianteNombre(producto.materiales[0].variante_nombre);
        setEspesor(producto.materiales[0].espesor || undefined);
      }

      setServicios(producto.servicios.map((s) => s.servicio_id));
      setAcabados(producto.acabados.map((a) => a.acabado_id));

      setTimeout(() => {
        isInitializingRef.current = false;
      }, 0);
    }
  }, [producto]);

  useEffect(() => {
    // Si cambia el tipo de venta, limpiar anchos si es mt2
    if (tipoVenta === 'mt2') {
      setAnchosDisponibles([]);
    }
  }, [tipoVenta]);

  useEffect(() => {
    if (isInitializingRef.current) {
      return;
    }
    setTecnologiasTintas((prev) =>
      prev.filter((tt) => tecnologiasSeleccionadas.includes(tt.tecnologia_id))
    );
  }, [tecnologiasSeleccionadas]);

  useEffect(() => {
    // Notificar cambios en el formulario
    if (onFormChange) {
      onFormChange();
    }
  }, [nombre, tipoVenta, anchosDisponibles, cantidadMinima, tecnologiasSeleccionadas, tecnologiasTintas, materialId, varianteNombre, espesor, servicios, acabados, impuesto, rangoPrecioId, rutaProduccionId]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) {
      newErrors.nombre = 'El nombre es obligatorio';
    } else if (nombre.length < 3) {
      newErrors.nombre = 'El nombre debe tener al menos 3 caracteres';
    }

    if (tipoVenta === 'mt_lineal' && anchosDisponibles.length === 0) {
      newErrors.anchos = 'Debe seleccionar al menos un ancho disponible';
    }

    if (tecnologiasSeleccionadas.length === 0) {
      newErrors.tecnologias = 'Debe seleccionar al menos una tecnología';
    }

    // Validar que cada tecnología tenga tintas
    const tintasErrors: Record<string, string> = {};
    tecnologiasSeleccionadas.forEach((tecId) => {
      const tecTintas = tecnologiasTintas.find((tt) => tt.tecnologia_id === tecId);
      if (!tecTintas || tecTintas.tintas.length === 0) {
        tintasErrors[tecId] = 'Debe seleccionar al menos una tinta';
      }
    });

    if (Object.keys(tintasErrors).length > 0) {
      newErrors.tintas = tintasErrors;
    }

    if (!materialId) {
      newErrors.materialId = 'Debe seleccionar un material';
    }

    if (materialId && !varianteNombre) {
      newErrors.varianteNombre = 'Debe seleccionar una variante';
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

    const data: CreateProductoGranFormatoData = {
      nombre: nombre.trim(),
      tipo_venta: tipoVenta,
      anchos_disponibles: tipoVenta === 'mt_lineal' ? anchosDisponibles : [],
      impuesto_iva: impuesto,
      rango_precio_id: rangoPrecioId,
      ruta_produccion_id: rutaProduccionId || undefined,
      cantidad_minima: cantidadMinima,
      tecnologias_tintas: tecnologiasTintas,
      material_id: materialId,
      variante_nombre: varianteNombre,
      espesor,
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
              placeholder="Ej: Banner Vinilo"
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
          <TipoVentaGranFormatoSelector
            value={tipoVenta}
            onChange={setTipoVenta}
            error={errors.tipoVenta}
          />
        </div>
      </Card>

      {tipoVenta === 'mt_lineal' && (
        <Card>
          <div className="p-6">
            <AnchosDisponiblesSelector
              anchosSeleccionados={anchosDisponibles}
              onChange={setAnchosDisponibles}
              error={errors.anchos}
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <CantidadMinimaInput
            tipoVenta={tipoVenta}
            value={cantidadMinima}
            onChange={setCantidadMinima}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TecnologiasGranFormatoSelector
            tecnologiasSeleccionadas={tecnologiasSeleccionadas}
            onChange={setTecnologiasSeleccionadas}
            error={errors.tecnologias}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TintasPorTecnologiaSelector
            tecnologiasSeleccionadas={tecnologiasSeleccionadas}
            tecnologiasTintas={tecnologiasTintas}
            onChange={setTecnologiasTintas}
            errors={errors.tintas}
          />
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
          <ServiciosSelectorGranFormato
            serviciosSeleccionados={servicios}
            onChange={setServicios}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <AcabadosSelectorGranFormato
            acabadosSeleccionados={acabados}
            onChange={setAcabados}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <RangoPrecioSelector
            tipoVenta={tipoVenta}
            rangoSeleccionado={rangoPrecioId}
            onChange={setRangoPrecioId}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ImpuestoSelector
            impuesto={impuesto}
            onChange={setImpuesto}
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

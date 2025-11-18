import { useState, useEffect } from 'react';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { MedidaPortabannerInput } from './MedidaPortabannerInput';
import { TecnologiasPortabannerSelector } from './TecnologiasPortabannerSelector';
import { ServiciosSelectorGranFormato } from '../gran-formato/ServiciosSelectorGranFormato';
import { AcabadosSelectorGranFormato } from '../gran-formato/AcabadosSelectorGranFormato';
import { ImpuestoSelector } from '../impresion-laser/ImpuestoSelector';
import { RangoPrecioSelector } from '../gran-formato/RangoPrecioSelector';
import { RutaSelector } from '../../rutas/RutaSelector';
import type {
  CreateProductoPortabannerData,
  ProductoPortabannerConRelaciones,
} from '../../../types/database';

interface ProductoPortabannerFormProps {
  producto?: ProductoPortabannerConRelaciones;
  onSubmit: (data: CreateProductoPortabannerData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  onFormChange?: () => void;
}

interface FormErrors {
  nombre?: string;
  ancho?: string;
  alto?: string;
  tecnologias?: string;
  impuesto?: string;
}

export function ProductoPortabannerForm({
  producto,
  onSubmit,
  onCancel,
  isLoading,
  onFormChange,
}: ProductoPortabannerFormProps) {
  const [nombre, setNombre] = useState('');
  const [ancho, setAncho] = useState<number | undefined>(undefined);
  const [alto, setAlto] = useState<number | undefined>(undefined);
  const [tecnologiasIds, setTecnologiasIds] = useState<string[]>([]);
  const [servicios, setServicios] = useState<string[]>([]);
  const [acabados, setAcabados] = useState<string[]>([]);
  const [impuesto, setImpuesto] = useState(21);
  const [rangoPrecioId, setRangoPrecioId] = useState<string | undefined>(undefined);
  const [rutaProduccionId, setRutaProduccionId] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (producto) {
      setNombre(producto.nombre);
      setAncho(producto.ancho_cm);
      setAlto(producto.alto_cm);
      setTecnologiasIds(producto.tecnologias?.map((t) => t.tecnologia_id) || []);
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
    ancho,
    alto,
    tecnologiasIds,
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

    if (!ancho || ancho <= 0) {
      newErrors.ancho = 'El ancho debe ser mayor a 0';
    }

    if (!alto || alto <= 0) {
      newErrors.alto = 'El alto debe ser mayor a 0';
    }

    if (tecnologiasIds.length === 0) {
      newErrors.tecnologias = 'Debe seleccionar al menos una tecnología';
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

    const data: CreateProductoPortabannerData = {
      nombre: nombre.trim(),
      ancho_cm: ancho!,
      alto_cm: alto!,
      tecnologia_id: tecnologiasIds[0],
      tecnologias_ids: tecnologiasIds,
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
              placeholder="Ej: Portabanner Premium 85x200"
              maxLength={100}
            />
            {errors.nombre && <p className="text-sm text-red-600 mt-1">{errors.nombre}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <MedidaPortabannerInput
            ancho={ancho}
            alto={alto}
            onAnchoChange={setAncho}
            onAltoChange={setAlto}
            errorAncho={errors.ancho}
            errorAlto={errors.alto}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <TecnologiasPortabannerSelector
            tecnologiasSeleccionadas={tecnologiasIds}
            onTecnologiasChange={setTecnologiasIds}
            error={errors.tecnologias}
          />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <ServiciosSelectorGranFormato serviciosSeleccionados={servicios} onChange={setServicios} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <AcabadosSelectorGranFormato acabadosSeleccionados={acabados} onChange={setAcabados} />
        </div>
      </Card>

      <Card>
        <div className="p-6">
          <RangoPrecioSelector
            tipoVenta="unidad"
            rangoSeleccionado={rangoPrecioId}
            onChange={setRangoPrecioId}
          />
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

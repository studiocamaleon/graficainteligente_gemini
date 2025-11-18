import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import type { TipoImpactoPrecio } from '../../types/database';

interface TipoImpactoSelectorProps {
  tipoImpacto: TipoImpactoPrecio | null;
  valorImpacto: number | null;
  valorImpactoSecundario?: number | null;
  onTipoChange: (tipo: TipoImpactoPrecio | null) => void;
  onValorChange: (valor: number | null) => void;
  onValorSecundarioChange?: (valor: number | null) => void;
  errors?: {
    tipo_impacto?: string;
    valor_impacto?: string;
    valor_impacto_secundario?: string;
  };
  disabled?: boolean;
}

const tipoImpactoOptions = [
  { value: '', label: 'Seleccionar tipo...' },
  { value: 'sin_impacto', label: 'Sin Impacto' },
  { value: 'precio_fijo', label: 'Precio Fijo' },
  { value: 'por_unidad', label: 'Por Unidad' },
  { value: 'por_minuto', label: 'Por Minuto' },
  { value: 'porcentual', label: 'Porcentual (%)' },
  { value: 'por_mt2', label: 'Por m²' },
  { value: 'por_mt_lineal', label: 'Por Metro Lineal' },
  { value: 'fijo_porcentual', label: 'Fijo + Porcentual' },
  { value: 'fijo_mt2', label: 'Fijo + Por m²' },
  { value: 'fijo_mt_lineal', label: 'Fijo + Por Metro Lineal' },
  { value: 'fijo_minuto', label: 'Fijo + Por Minuto' },
];

const isTipoCombinado = (tipo: TipoImpactoPrecio | null): boolean => {
  if (!tipo) return false;
  return ['fijo_porcentual', 'fijo_mt2', 'fijo_mt_lineal', 'fijo_minuto'].includes(tipo);
};

const getValorPrimarioLabel = (tipo: TipoImpactoPrecio | null): string => {
  if (!tipo) return 'Valor';

  if (isTipoCombinado(tipo)) {
    return 'Valor Fijo ($)';
  }

  switch (tipo) {
    case 'sin_impacto':
      return 'Sin valor (no aplica)';
    case 'precio_fijo':
      return 'Precio ($)';
    case 'por_unidad':
      return 'Precio por unidad ($)';
    case 'por_minuto':
      return 'Precio por minuto ($)';
    case 'porcentual':
      return 'Porcentaje (%)';
    case 'por_mt2':
      return 'Precio por m² ($)';
    case 'por_mt_lineal':
      return 'Precio por metro lineal ($)';
    default:
      return 'Valor';
  }
};

const getValorSecundarioLabel = (tipo: TipoImpactoPrecio | null): string => {
  if (!tipo) return 'Valor Secundario';

  switch (tipo) {
    case 'fijo_porcentual':
      return 'Porcentaje (%)';
    case 'fijo_mt2':
      return 'Valor por m² ($)';
    case 'fijo_mt_lineal':
      return 'Valor por metro lineal ($)';
    case 'fijo_minuto':
      return 'Valor por minuto ($)';
    default:
      return 'Valor Secundario';
  }
};

const getValorPrimarioPlaceholder = (tipo: TipoImpactoPrecio | null): string => {
  if (!tipo) return '0.00';

  switch (tipo) {
    case 'sin_impacto':
      return 'N/A';
    case 'porcentual':
      return 'Ej: 15.5';
    default:
      return 'Ej: 1000.00';
  }
};

const getValorSecundarioPlaceholder = (tipo: TipoImpactoPrecio | null): string => {
  if (!tipo) return '0.00';

  switch (tipo) {
    case 'fijo_porcentual':
      return 'Ej: 15.5';
    default:
      return 'Ej: 500.00';
  }
};

const requiresValue = (tipo: TipoImpactoPrecio | null): boolean => {
  return tipo !== 'sin_impacto' && tipo !== null;
};

const getDescripcion = (tipo: TipoImpactoPrecio | null): string => {
  if (!tipo) return '';

  switch (tipo) {
    case 'sin_impacto':
      return 'Este servicio no afectará el precio final.';
    case 'precio_fijo':
      return 'Se agregará un monto fijo al precio total.';
    case 'por_unidad':
      return 'El precio se multiplicará por la cantidad de unidades.';
    case 'por_minuto':
      return 'El precio se calculará según el tiempo en minutos.';
    case 'porcentual':
      return 'Se aplicará un porcentaje sobre el precio base del producto.';
    case 'por_mt2':
      return 'El precio se multiplicará por los metros cuadrados del producto.';
    case 'por_mt_lineal':
      return 'El precio se multiplicará por los metros lineales del producto.';
    case 'fijo_porcentual':
      return 'Se sumará el valor fijo más un porcentaje adicional sobre el precio base del producto.';
    case 'fijo_mt2':
      return 'Se sumará el valor fijo más el cálculo por metros cuadrados del producto.';
    case 'fijo_mt_lineal':
      return 'Se sumará el valor fijo más el cálculo por metros lineales del producto.';
    case 'fijo_minuto':
      return 'Se sumará el valor fijo más el cálculo por tiempo en minutos.';
    default:
      return '';
  }
};

export function TipoImpactoSelector({
  tipoImpacto,
  valorImpacto,
  valorImpactoSecundario,
  onTipoChange,
  onValorChange,
  onValorSecundarioChange,
  errors = {},
  disabled = false,
}: TipoImpactoSelectorProps) {
  const handleTipoChange = (value: string) => {
    const newTipo = value === '' ? null : (value as TipoImpactoPrecio);
    onTipoChange(newTipo);

    if (newTipo === 'sin_impacto') {
      onValorChange(0);
      if (onValorSecundarioChange) {
        onValorSecundarioChange(null);
      }
    } else if (newTipo === null) {
      onValorChange(null);
      if (onValorSecundarioChange) {
        onValorSecundarioChange(null);
      }
    } else if (!isTipoCombinado(newTipo) && onValorSecundarioChange) {
      onValorSecundarioChange(null);
    }
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      onValorChange(null);
    } else {
      const numValue = parseFloat(value);
      onValorChange(isNaN(numValue) ? null : numValue);
    }
  };

  const handleValorSecundarioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onValorSecundarioChange) return;

    const value = e.target.value;
    if (value === '') {
      onValorSecundarioChange(null);
    } else {
      const numValue = parseFloat(value);
      onValorSecundarioChange(isNaN(numValue) ? null : numValue);
    }
  };

  const showValorInput = requiresValue(tipoImpacto);
  const valorDisabled = disabled || tipoImpacto === 'sin_impacto';
  const showValorSecundario = isTipoCombinado(tipoImpacto) && onValorSecundarioChange;

  return (
    <div className="space-y-4">
      <Select
        label="Tipo de Impacto en Precio"
        value={tipoImpacto || ''}
        onChange={handleTipoChange}
        options={tipoImpactoOptions}
        error={errors.tipo_impacto}
        disabled={disabled}
        required
      />

      {showValorInput && (
        <div className={showValorSecundario ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
          <Input
            label={getValorPrimarioLabel(tipoImpacto)}
            type="number"
            step="0.01"
            min="0"
            value={valorImpacto ?? ''}
            onChange={handleValorChange}
            placeholder={getValorPrimarioPlaceholder(tipoImpacto)}
            error={errors.valor_impacto}
            disabled={valorDisabled}
            required
          />

          {showValorSecundario && (
            <Input
              label={getValorSecundarioLabel(tipoImpacto)}
              type="number"
              step="0.01"
              min="0"
              value={valorImpactoSecundario ?? ''}
              onChange={handleValorSecundarioChange}
              placeholder={getValorSecundarioPlaceholder(tipoImpacto)}
              error={errors.valor_impacto_secundario}
              disabled={disabled}
              required
            />
          )}
        </div>
      )}

      {tipoImpacto && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">{getDescripcion(tipoImpacto)}</p>
        </div>
      )}
    </div>
  );
}

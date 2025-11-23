import { MedioCobro, TipoMedioCobro } from '../../types/medios-cobro';
import { Select } from '../ui/Select';

interface MedioCobroSelectorProps {
  value: string;
  onChange: (value: string) => void;
  medios: MedioCobro[];
  required?: boolean;
  disabled?: boolean;
  showDetails?: boolean;
}

export function MedioCobroSelector({
  value,
  onChange,
  medios,
  required = false,
  disabled = false,
  showDetails = false,
}: MedioCobroSelectorProps) {
  const mediosPorTipo = medios.reduce((acc, medio) => {
    if (!acc[medio.tipo]) {
      acc[medio.tipo] = [];
    }
    acc[medio.tipo].push(medio);
    return acc;
  }, {} as Record<TipoMedioCobro, MedioCobro[]>);

  const getTipoLabel = (tipo: TipoMedioCobro) => {
    switch (tipo) {
      case 'pasarela':
        return 'Pasarelas de Pago';
      case 'bancario':
        return 'Medios Bancarios';
      case 'efectivo':
        return 'Efectivo';
    }
  };

  const selectedMedio = medios.find((m) => m.id === value);

  return (
    <div>
      <Select value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}>
        <option value="">Seleccionar medio de cobro...</option>
        {Object.entries(mediosPorTipo).map(([tipo, mediosDelTipo]) => (
          <optgroup key={tipo} label={getTipoLabel(tipo as TipoMedioCobro)}>
            {mediosDelTipo.map((medio) => (
              <option key={medio.id} value={medio.id}>
                {medio.nombre}
                {showDetails && medio.comision_porcentaje > 0 && ` (${medio.comision_porcentaje}%)`}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      {showDetails && selectedMedio && (
        <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <div className="space-y-1">
            {selectedMedio.comision_porcentaje > 0 && (
              <p className="text-gray-700">
                <span className="font-medium">Comisión:</span>{' '}
                <span className="text-orange-600 font-semibold">{selectedMedio.comision_porcentaje}%</span>
              </p>
            )}
            {selectedMedio.dias_liberacion > 0 ? (
              <p className="text-gray-700">
                <span className="font-medium">Liberación:</span>{' '}
                <span className="text-blue-600 font-semibold">{selectedMedio.dias_liberacion} días</span>
              </p>
            ) : (
              <p className="text-gray-700">
                <span className="font-medium">Liberación:</span>{' '}
                <span className="text-green-600 font-semibold">Inmediata</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface TipoCopiaSelectorProps {
  tiposSeleccionados: string[];
  onChange: (tipos: string[]) => void;
  error?: string;
}

export function TipoCopiaSelector({
  tiposSeleccionados,
  onChange,
  error,
}: TipoCopiaSelectorProps) {
  const opciones = [
    { value: 'duplicado', label: 'Duplicado' },
    { value: 'triplicado', label: 'Triplicado' },
    { value: 'cuadruplicado', label: 'Cuadruplicado' },
  ];

  const toggleTipo = (valor: string) => {
    if (tiposSeleccionados.includes(valor)) {
      onChange(tiposSeleccionados.filter((t) => t !== valor));
    } else {
      onChange([...tiposSeleccionados, valor]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Tipo de Copia
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="grid grid-cols-3 gap-3">
        {opciones.map((opcion) => {
          const isSelected = tiposSeleccionados.includes(opcion.value);
          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => toggleTipo(opcion.value)}
              className={`relative p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  {opcion.label}
                </span>
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

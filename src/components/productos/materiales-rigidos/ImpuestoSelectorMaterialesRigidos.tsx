interface ImpuestoSelectorMaterialesRigidosProps {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

export function ImpuestoSelectorMaterialesRigidos({
  value,
  onChange,
  error,
}: ImpuestoSelectorMaterialesRigidosProps) {
  const opciones = [
    { value: 10.5, label: '10.5%' },
    { value: 21, label: '21%' },
  ];

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Impuesto IVA
        <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        {opciones.map((opcion) => {
          const isSelected = value === opcion.value;
          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => onChange(opcion.value)}
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
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-white'
                      : 'border-gray-300 bg-white'
                  }`}
                >
                  {isSelected && <div className="w-3 h-3 rounded-full bg-blue-500" />}
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

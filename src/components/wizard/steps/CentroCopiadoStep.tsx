import { CentroCopiadoItemForm, ItemCopiadoConfig } from '../../centro-copiado/CentroCopiadoItemForm';

interface CentroCopiadoStepProps {
    config: Partial<ItemCopiadoConfig>;
    onChange: (config: Partial<ItemCopiadoConfig>) => void;
    onPriceChange: (price: number) => void;
}

export function CentroCopiadoStep({ config, onChange, onPriceChange }: CentroCopiadoStepProps) {
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    Configuración de Copiado
                </h3>

                <CentroCopiadoItemForm
                    itemNumber={1}
                    value={config}
                    onChange={onChange}
                    onRemove={() => { }}
                    onPriceCalculated={onPriceChange}
                // Description is handled at the Wizard level if needed, or we can use internal logic
                />
            </div>
        </div>
    );
}


import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import type { StationStep } from '../../hooks/useProductionStations';
import { StationStepCard } from './StationStepCard';
import { Badge } from '../ui/Badge';

interface StationStepGroupProps {
    steps: StationStep[];
    onViewDetails: (step: StationStep) => void;
}

export function StationStepGroup({ steps, onViewDetails }: StationStepGroupProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (steps.length === 0) return null;

    // Usamos el primer paso como representante del grupo para los datos comunes
    const representative = steps[0];

    return (
        <div className="border border-blue-200 rounded-lg bg-white shadow-sm overflow-hidden transition-all duration-200">
            <div
                className="p-3 bg-blue-50 cursor-pointer flex items-center justify-between hover:bg-blue-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border border-blue-100 shadow-sm">
                        <Layers className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 text-sm">
                            {representative.paso_nombre}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-blue-700 mt-0.5">
                            <span className="font-medium">Orden #{representative.numero_orden}</span>
                            <span>•</span>
                            <span className="truncate max-w-[150px]">{representative.cliente_nombre}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge variant="blue" size="sm" className="shadow-none">
                        {steps.length} items
                    </Badge>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-3 bg-gray-50 border-t border-blue-100 animate-in slide-in-from-top-2">
                    {steps.map(step => (
                        <StationStepCard
                            key={step.ruta_id}
                            {...step}
                            onViewDetails={() => onViewDetails(step)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

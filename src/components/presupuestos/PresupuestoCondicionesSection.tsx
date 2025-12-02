import { useState, useEffect } from 'react';
import { FileText, Edit2, Eye } from 'lucide-react';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { useCondicionesComerciales } from '../../hooks/useCondicionesComerciales';

interface PresupuestoCondicionesSectionProps {
  condicionesText: string;
  onCondicionesChange: (text: string) => void;
}

export function PresupuestoCondicionesSection({
  condicionesText,
  onCondicionesChange,
}: PresupuestoCondicionesSectionProps) {
  const { condiciones, getCondicionDefault } = useCondicionesComerciales();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  useEffect(() => {
    // Cargar condición default si no hay texto
    if (!condicionesText) {
      loadDefaultCondicion();
    }
  }, []);

  const loadDefaultCondicion = async () => {
    const defaultCondicion = await getCondicionDefault();
    if (defaultCondicion) {
      onCondicionesChange(defaultCondicion.contenido);
      setSelectedTemplateId(defaultCondicion.id);
    }
  };

  const templateOptions = [
    { value: '', label: 'Seleccionar template' },
    ...condiciones
      .filter((c) => c.is_active)
      .map((c) => ({
        value: c.id,
        label: c.nombre,
      })),
  ];

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = condiciones.find((c) => c.id === templateId);
    if (template) {
      onCondicionesChange(template.contenido);
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Condiciones Comerciales
        </h2>
        <p className="text-sm text-gray-600">
          Selecciona un template o escribe condiciones personalizadas
        </p>
      </div>

      {/* Selector de template */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Template
        </label>
        <Select
          value={selectedTemplateId}
          onChange={(value) => handleTemplateChange(value)}
          options={templateOptions}
        />
      </div>

      {/* Editor/Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Condiciones
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Ver Preview
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-2" />
                Editar
              </>
            )}
          </Button>
        </div>

        {isEditing ? (
          <textarea
            value={condicionesText}
            onChange={(e) => onCondicionesChange(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
            placeholder="Escribe las condiciones comerciales..."
          />
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
              {condicionesText || 'Sin condiciones'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Star,
  Edit2,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  MoreVertical,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { CondicionComercial } from '../../types/presupuestos';

interface CondicionComercialCardProps {
  condicion: CondicionComercial;
  onEdit: (condicion: CondicionComercial) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleActivo: (id: string) => void;
  onMarcarDefault: (id: string) => void;
  isDragging?: boolean;
}

export function CondicionComercialCard({
  condicion,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleActivo,
  onMarcarDefault,
  isDragging = false,
}: CondicionComercialCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <Card
      className={`p-4 transition-all hover:shadow-lg ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${!condicion.is_active ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="cursor-move mt-1 text-gray-400 hover:text-gray-600">
          <GripVertical className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {condicion.nombre}
              </h3>
              {condicion.es_default && (
                <Badge variant="warning" className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" />
                  Por defecto
                </Badge>
              )}
            </div>

            {/* Actions Menu */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-400 hover:text-gray-600"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {showMenu && (
                <>
                  {/* Overlay para cerrar */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />

                  {/* Menu dropdown */}
                  <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                    <button
                      onClick={() => {
                        onEdit(condicion);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar
                    </button>

                    {!condicion.es_default && (
                      <button
                        onClick={() => {
                          onMarcarDefault(condicion.id);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Star className="w-4 h-4" />
                        Marcar como predeterminada
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onToggleActivo(condicion.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      {condicion.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          Activar
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onDuplicate(condicion.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Duplicar
                    </button>

                    <div className="border-t border-gray-200 my-1" />

                    <button
                      onClick={() => {
                        onDelete(condicion.id);
                        setShowMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 mb-3">
            {!condicion.is_active && (
              <Badge variant="secondary">Inactiva</Badge>
            )}
            <span className="text-xs text-gray-500">
              Orden: {condicion.orden}
            </span>
          </div>

          {/* Preview del contenido */}
          <div className="mb-3">
            {showPreview ? (
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                  {condicion.contenido}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                {truncateText(condicion.contenido, 150)}
              </p>
            )}
          </div>

          {/* Toggle preview button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-blue-600 hover:text-blue-700"
          >
            {showPreview ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Ocultar contenido
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Ver contenido completo
              </>
            )}
          </Button>

          {/* Footer metadata */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Creada el {new Date(condicion.created_at).toLocaleDateString('es-ES')}
          </div>
        </div>
      </div>
    </Card>
  );
}

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Save, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface StepCommentEditorProps {
  comentario: string | null;
  onSave: (comentario: string | null) => Promise<void>;
  disabled?: boolean;
}

export function StepCommentEditor({ comentario, onSave, disabled = false }: StepCommentEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(comentario || '');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(comentario || '');
  }, [comentario]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(value.length, value.length);
    }
  }, [isEditing, value.length]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const trimmedValue = value.trim();
      await onSave(trimmedValue || null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error guardando comentario:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(comentario || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => !disabled && setIsEditing(true)}
        disabled={disabled}
        className={`flex items-start gap-2 w-full text-left px-3 py-2 rounded-lg transition-colors ${
          comentario
            ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200'
            : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title={disabled ? 'No se pueden editar comentarios en este estado' : 'Click para editar comentario'}
      >
        <MessageSquare
          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
            comentario ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          {comentario ? (
            <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">{comentario}</p>
          ) : (
            <p className="text-sm text-gray-500 italic">
              Click para agregar comentario para el operador...
            </p>
          )}
        </div>
      </button>
    );
  }

  const charCount = value.length;
  const maxChars = 500;

  return (
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          maxLength={maxChars}
          rows={3}
          className="w-full px-3 py-2 text-sm border-2 border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-50"
          placeholder="Escribe comentarios o instrucciones especiales para el operador de producción..."
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {charCount}/{maxChars}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          <kbd className="px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded">Ctrl+Enter</kbd> para guardar,
          <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-gray-100 border border-gray-300 rounded">Esc</kbd> para cancelar
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={saving}
          >
            <X className="w-4 h-4" />
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-1" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

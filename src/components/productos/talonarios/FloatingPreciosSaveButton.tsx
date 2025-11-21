import { useEffect, useState } from 'react';
import { Save, CheckCircle, AlertCircle } from 'lucide-react';

interface Props {
  hasChanges: boolean;
  onSave: () => Promise<void>;
  isSaving: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export function FloatingPreciosSaveButton({
  hasChanges,
  onSave,
  isSaving,
}: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Show/hide based on changes
  useEffect(() => {
    if (hasChanges) {
      setIsVisible(true);
      setSaveStatus('idle');
      setErrorMessage(null);
    } else if (saveStatus === 'success') {
      // Keep visible briefly after success
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSaveStatus('idle');
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [hasChanges, saveStatus]);

  // Update saving status
  useEffect(() => {
    if (isSaving) {
      setSaveStatus('saving');
    }
  }, [isSaving]);

  const handleSave = async () => {
    try {
      setSaveStatus('saving');
      setErrorMessage(null);
      await onSave();
      setSaveStatus('success');
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Error al guardar');
    }
  };

  if (!isVisible) {
    return null;
  }

  const getStatusContent = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          icon: (
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          ),
          text: 'Guardando cambios...',
          showButton: true,
          buttonText: 'Guardando...',
          buttonIcon: (
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ),
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
          text: 'Guardado exitosamente',
          showButton: false,
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4 text-red-500" />,
          text: errorMessage || 'Error al guardar',
          showButton: true,
          buttonText: 'Reintentar',
          buttonIcon: <Save className="w-3.5 h-3.5" />,
        };
      default:
        return {
          icon: (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
          ),
          text: 'Cambios sin guardar',
          showButton: true,
          buttonText: 'Guardar',
          buttonIcon: <Save className="w-3.5 h-3.5" />,
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div
      className="fixed bottom-6 right-6 z-50 transition-all duration-300 ease-out"
      style={{
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.08)] border border-gray-200/50 overflow-hidden hover:shadow-[0_12px_40px_rgba(0,0,0,0.16),0_4px_12px_rgba(0,0,0,0.1)] transition-all duration-300">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {statusContent.icon}
              <span className="text-sm font-medium text-gray-700 truncate">
                {statusContent.text}
              </span>
            </div>

            {statusContent.showButton && (
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg hover:from-blue-700 hover:to-blue-600 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
              >
                {statusContent.buttonIcon}
                {statusContent.buttonText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

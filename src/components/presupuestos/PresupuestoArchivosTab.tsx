import { FileText, Download } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';

interface PresupuestoArchivosTabProps {
  presupuestoId: string;
}

export function PresupuestoArchivosTab({ presupuestoId }: PresupuestoArchivosTabProps) {
  // TODO: Implementar con hook usePresupuestoArchivos en futuras fases
  const archivos: any[] = [];

  if (archivos.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No hay archivos adjuntos"
        description="Este presupuesto no tiene archivos asociados"
      />
    );
  }

  return (
    <div className="space-y-4">
      {archivos.map((archivo: any) => (
        <div
          key={archivo.id}
          className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{archivo.nombre_archivo}</h3>
              <p className="text-sm text-gray-500">
                {(archivo.tamano_bytes / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
        </div>
      ))}
    </div>
  );
}

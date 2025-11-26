import { FileText, Download, Eye, File, Image as ImageIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { useCentroCopiadoOrdenArchivos, type ArchivoOrdenCopiado } from '../../hooks/useCentroCopiadoOrdenArchivos';
import { useState } from 'react';

interface Props {
  ordenId: string;
}

export function CentroCopiadoOrdenArchivos({ ordenId }: Props) {
  const { archivos, loading, descargarArchivo, obtenerUrlPublica, formatearTamano } = useCentroCopiadoOrdenArchivos(ordenId);
  const [descargando, setDescargando] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<ArchivoOrdenCopiado | null>(null);

  const getIconoArchivo = (tipoMime: string) => {
    if (tipoMime.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (tipoMime === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const handleDescargar = async (archivo: ArchivoOrdenCopiado) => {
    setDescargando(archivo.id);
    try {
      await descargarArchivo(archivo);
    } finally {
      setDescargando(null);
    }
  };

  const handlePreview = (archivo: ArchivoOrdenCopiado) => {
    if (archivo.tipo_mime === 'application/pdf' || archivo.tipo_mime.startsWith('image/')) {
      setPreviewing(archivo);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-500">Cargando archivos...</span>
        </div>
      </Card>
    );
  }

  if (archivos.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={FileText}
          title="No hay archivos"
          description="Esta orden no tiene archivos asociados"
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900">Archivos Asociados</h3>
              <Badge variant="secondary">{archivos.length}</Badge>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {archivos.map((archivo) => (
            <div key={archivo.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getIconoArchivo(archivo.tipo_mime)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {archivo.nombre_archivo}
                    </p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatearTamano(archivo.tamano_bytes)}
                      </span>
                      {archivo.paginas_detectadas && (
                        <span className="text-xs text-gray-500">
                          {archivo.paginas_detectadas} {archivo.paginas_detectadas === 1 ? 'página' : 'páginas'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {(archivo.tipo_mime === 'application/pdf' || archivo.tipo_mime.startsWith('image/')) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(archivo)}
                      title="Ver archivo"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDescargar(archivo)}
                    disabled={descargando === archivo.id}
                    title="Descargar archivo"
                  >
                    {descargando === archivo.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {previewing && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewing(null)}
        >
          <div
            className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{previewing.nombre_archivo}</h3>
              <Button variant="ghost" onClick={() => setPreviewing(null)}>
                Cerrar
              </Button>
            </div>
            <div className="p-4 overflow-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {previewing.tipo_mime === 'application/pdf' ? (
                <iframe
                  src={obtenerUrlPublica(previewing)}
                  className="w-full h-full min-h-[600px]"
                  title={previewing.nombre_archivo}
                />
              ) : (
                <img
                  src={obtenerUrlPublica(previewing)}
                  alt={previewing.nombre_archivo}
                  className="max-w-full h-auto mx-auto"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

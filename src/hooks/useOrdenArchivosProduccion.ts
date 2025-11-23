import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_ORDEN_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB
const BUCKET_NAME = 'orden-produccion-archivos';

interface ArchivoProduccion {
  id: string;
  orden_id: string;
  company_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  version: number;
  reemplaza_a: string | null;
  etiquetas: string[] | null;
  notas: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    full_name: string;
  };
}

interface UploadArchivoProduccionData {
  file: File;
  etiquetas?: string[];
  notas?: string;
  reemplaza_a?: string;
}

export function useOrdenArchivosProduccion(ordenId: string) {
  const [archivos, setArchivos] = useState<ArchivoProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const { profile } = useAuth();

  // Verificar si el usuario puede subir archivos
  const canUpload = profile?.role && ['operator', 'admin', 'super_admin'].includes(profile.role);

  // Cargar archivos
  const loadArchivos = async () => {
    console.log('[useOrdenArchivosProduccion] loadArchivos llamado:', { ordenId });

    if (!ordenId) {
      console.log('[useOrdenArchivosProduccion] No hay ordenId, saliendo early y estableciendo loading=false');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('[useOrdenArchivosProduccion] Iniciando carga...');

      const { data, error: fetchError } = await supabase
        .from('ordenes_trabajo_archivos_produccion')
        .select(`
          *,
          uploader:uploaded_by(full_name)
        `)
        .eq('orden_id', ordenId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      console.log('[useOrdenArchivosProduccion] Archivos producción cargados:', data?.length || 0);
      setArchivos(data || []);

      // Calcular tamaño total
      const total = (data || []).reduce((sum, file) => sum + file.tamano_bytes, 0);
      setTotalSize(total);
    } catch (err: any) {
      console.error('[useOrdenArchivosProduccion] Error loading archivos produccion:', err);
      setError(err.message);
    } finally {
      console.log('[useOrdenArchivosProduccion] Finalizando carga, setLoading(false)');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchivos();
  }, [ordenId]);

  // Obtener espacio disponible
  const getAvailableSpace = () => {
    return MAX_ORDEN_TOTAL_SIZE - totalSize;
  };

  // Validar archivo antes de subir
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Validar permisos
    if (!canUpload) {
      return {
        valid: false,
        error: 'No tiene permisos para subir archivos de producción'
      };
    }

    // Validar tamaño individual
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `El archivo excede el tamaño máximo de 500MB. Tamaño del archivo: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      };
    }

    // Validar espacio disponible
    const availableSpace = getAvailableSpace();
    if (file.size > availableSpace) {
      return {
        valid: false,
        error: `No hay suficiente espacio. Disponible: ${(availableSpace / (1024 * 1024)).toFixed(2)}MB, Necesario: ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      };
    }

    // Validar tipos MIME permitidos (enfocados en producción)
    const allowedTypes = [
      'application/pdf',
      'application/vnd.adobe.illustrator',
      'application/postscript',
      'image/vnd.adobe.photoshop',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/svg+xml',
      'application/zip',
      'application/x-rar-compressed',
      'application/octet-stream' // Para archivos especiales de diseño
    ];

    if (!allowedTypes.includes(file.type) && file.type !== '') {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'ai', 'eps', 'psd', 'cdr', 'svg', 'tiff', 'tif', 'plt', 'dxf', 'indd'];

      if (!extension || !allowedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `Tipo de archivo no permitido para producción. Formatos válidos: PDF, AI, EPS, PSD, CDR, TIFF, SVG, PLT, DXF, INDD`
        };
      }
    }

    return { valid: true };
  };

  // Subir archivo de producción
  const uploadArchivo = async ({ file, etiquetas, notas, reemplaza_a }: UploadArchivoProduccionData) => {
    if (!profile?.company_id) {
      throw new Error('No se pudo obtener el ID de la empresa');
    }

    // Validar archivo
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      // Determinar versión
      let version = 1;
      if (reemplaza_a) {
        const archivoAnterior = archivos.find(a => a.id === reemplaza_a);
        if (archivoAnterior) {
          version = archivoAnterior.version + 1;
        }
      }

      // Generar nombre único para storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${profile.company_id}/${ordenId}/produccion/${fileName}`;

      // Subir a storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setUploadProgress(50);

      // Crear registro en base de datos
      const { data, error: dbError } = await supabase
        .from('ordenes_trabajo_archivos_produccion')
        .insert({
          orden_id: ordenId,
          company_id: profile.company_id,
          nombre_archivo: file.name,
          nombre_storage: fileName,
          tipo_mime: file.type || 'application/octet-stream',
          tamano_bytes: file.size,
          storage_path: storagePath,
          version,
          reemplaza_a: reemplaza_a || null,
          etiquetas: etiquetas || null,
          notas: notas || null,
          uploaded_by: profile.id
        })
        .select()
        .single();

      if (dbError) {
        // Si falla la BD, eliminar el archivo del storage
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw dbError;
      }

      setUploadProgress(100);

      // Recargar lista
      await loadArchivos();

      return data;
    } catch (err: any) {
      console.error('Error uploading archivo produccion:', err);
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Descargar archivo
  const downloadArchivo = async (archivoId: string) => {
    try {
      const archivo = archivos.find(a => a.id === archivoId);
      if (!archivo) {
        throw new Error('Archivo no encontrado');
      }

      // Obtener URL firmada
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(archivo.storage_path, 3600); // 1 hora

      if (error) throw error;

      if (data?.signedUrl) {
        // Descargar archivo
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = archivo.nombre_archivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('Error downloading archivo produccion:', err);
      setError(err.message);
      throw err;
    }
  };

  // Eliminar archivo
  const deleteArchivo = async (archivoId: string) => {
    try {
      const archivo = archivos.find(a => a.id === archivoId);
      if (!archivo) {
        throw new Error('Archivo no encontrado');
      }

      // Verificar permisos (solo quien subió o admins)
      const canDelete = profile?.id === archivo.uploaded_by ||
        (profile?.role && ['admin', 'super_admin'].includes(profile.role));

      if (!canDelete) {
        throw new Error('No tiene permisos para eliminar este archivo');
      }

      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([archivo.storage_path]);

      if (storageError) throw storageError;

      // Eliminar de base de datos
      const { error: dbError } = await supabase
        .from('ordenes_trabajo_archivos_produccion')
        .delete()
        .eq('id', archivoId);

      if (dbError) throw dbError;

      // Recargar lista
      await loadArchivos();
    } catch (err: any) {
      console.error('Error deleting archivo produccion:', err);
      setError(err.message);
      throw err;
    }
  };

  // Obtener historial de versiones de un archivo
  const getVersionHistory = (archivoId: string): ArchivoProduccion[] => {
    const archivo = archivos.find(a => a.id === archivoId);
    if (!archivo) return [];

    const history: ArchivoProduccion[] = [archivo];

    // Buscar versiones anteriores recursivamente
    let currentArch = archivo;
    while (currentArch.reemplaza_a) {
      const prevArch = archivos.find(a => a.id === currentArch.reemplaza_a);
      if (!prevArch) break;
      history.push(prevArch);
      currentArch = prevArch;
    }

    return history;
  };

  // Descargar todos los archivos
  const downloadAll = async () => {
    try {
      for (const archivo of archivos) {
        await downloadArchivo(archivo.id);
        // Pequeña pausa entre descargas
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err: any) {
      console.error('Error downloading all archivos:', err);
      setError(err.message);
      throw err;
    }
  };

  // Calcular porcentaje usado
  const getUsagePercentage = () => {
    return (totalSize / MAX_ORDEN_TOTAL_SIZE) * 100;
  };

  // Formatear tamaño
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Obtener color del badge según etiqueta
  const getEtiquetaColor = (etiqueta: string): string => {
    const colors: Record<string, string> = {
      'final': 'bg-green-100 text-green-800',
      'revision': 'bg-yellow-100 text-yellow-800',
      'aprobado': 'bg-blue-100 text-blue-800',
      'backup': 'bg-gray-100 text-gray-800',
      'prueba': 'bg-purple-100 text-purple-800'
    };
    return colors[etiqueta.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return {
    archivos,
    loading,
    uploading,
    uploadProgress,
    error,
    totalSize,
    availableSpace: getAvailableSpace(),
    usagePercentage: getUsagePercentage(),
    maxTotalSize: MAX_ORDEN_TOTAL_SIZE,
    maxFileSize: MAX_FILE_SIZE,
    canUpload,
    uploadArchivo,
    downloadArchivo,
    deleteArchivo,
    downloadAll,
    validateFile,
    getVersionHistory,
    formatSize,
    getEtiquetaColor,
    refresh: loadArchivos
  };
}

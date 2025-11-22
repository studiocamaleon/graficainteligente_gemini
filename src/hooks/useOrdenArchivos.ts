import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_ORDEN_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB
const BUCKET_NAME = 'orden-trabajo-archivos';

interface Archivo {
  id: string;
  orden_id: string;
  company_id: string;
  nombre_archivo: string;
  nombre_storage: string;
  tipo_mime: string;
  tamano_bytes: number;
  storage_path: string;
  descripcion: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    nombre_completo: string;
  };
}

interface UploadArchivoData {
  file: File;
  descripcion?: string;
}

export function useOrdenArchivos(ordenId: string) {
  const [archivos, setArchivos] = useState<Archivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const { profile } = useAuth();

  // Cargar archivos
  const loadArchivos = async () => {
    if (!ordenId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('ordenes_trabajo_archivos')
        .select(`
          *,
          uploader:uploaded_by(nombre_completo)
        `)
        .eq('orden_id', ordenId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setArchivos(data || []);

      // Calcular tamaño total
      const total = (data || []).reduce((sum, file) => sum + file.tamano_bytes, 0);
      setTotalSize(total);
    } catch (err: any) {
      console.error('Error loading archivos:', err);
      setError(err.message);
    } finally {
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

    // Validar tipo MIME permitido
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.adobe.illustrator',
      'application/postscript',
      'image/vnd.adobe.photoshop',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/tiff',
      'image/gif',
      'image/bmp',
      'image/webp',
      'image/svg+xml',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'text/plain',
      'text/csv',
      'application/octet-stream' // Para archivos como .ai, .cdr, .eps
    ];

    if (!allowedTypes.includes(file.type) && file.type !== '') {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['ai', 'cdr', 'eps', 'psd', 'indd', 'svg', 'plt', 'dxf'];

      if (!extension || !allowedExtensions.includes(extension)) {
        return {
          valid: false,
          error: `Tipo de archivo no permitido. Por favor, suba documentos, imágenes o archivos de diseño válidos.`
        };
      }
    }

    return { valid: true };
  };

  // Subir archivo
  const uploadArchivo = async ({ file, descripcion }: UploadArchivoData) => {
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

      // Generar nombre único para storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storagePath = `${profile.company_id}/${ordenId}/${fileName}`;

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
        .from('ordenes_trabajo_archivos')
        .insert({
          orden_id: ordenId,
          company_id: profile.company_id,
          nombre_archivo: file.name,
          nombre_storage: fileName,
          tipo_mime: file.type || 'application/octet-stream',
          tamano_bytes: file.size,
          storage_path: storagePath,
          descripcion: descripcion || null,
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
      console.error('Error uploading archivo:', err);
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
      console.error('Error downloading archivo:', err);
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

      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([archivo.storage_path]);

      if (storageError) throw storageError;

      // Eliminar de base de datos
      const { error: dbError } = await supabase
        .from('ordenes_trabajo_archivos')
        .delete()
        .eq('id', archivoId);

      if (dbError) throw dbError;

      // Recargar lista
      await loadArchivos();
    } catch (err: any) {
      console.error('Error deleting archivo:', err);
      setError(err.message);
      throw err;
    }
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
    uploadArchivo,
    downloadArchivo,
    deleteArchivo,
    downloadAll,
    validateFile,
    formatSize,
    refresh: loadArchivos
  };
}

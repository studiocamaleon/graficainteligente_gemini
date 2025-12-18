import { useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export type StorageBucket = 'centro-copiado-archivos' | 'ordenes-trabajo-archivos';

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});

  const uploadFile = async (
    file: File,
    companyId: string,
    ordenId: string,
    fileId: string,
    bucket: StorageBucket = 'centro-copiado-archivos'
  ): Promise<{ storagePath: string; nombreStorage: string } | null> => {
    const nombreStorage = `${fileId}-${file.name}`;

    // Detectar si es un ID temporal (comienza con "temp_")
    const isTemporalId = ordenId.startsWith('temp_');

    // Construir path según sea temporal o definitivo
    const storagePath = isTemporalId
      ? `${companyId}/temporal/${ordenId}/${nombreStorage}`
      : `${companyId}/${ordenId}/${nombreStorage}`;

    console.log('[useFileUpload] Subiendo archivo:', {
      bucket,
      isTemporalId,
      ordenId,
      storagePath
    });

    // Inicializar progreso
    setUploadProgress(prev => ({
      ...prev,
      [fileId]: {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      },
    }));

    try {
      // Subir archivo a Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Actualizar progreso a completado
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          progress: 100,
          status: 'completed',
        },
      }));

      return { storagePath, nombreStorage };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al subir archivo';

      setUploadProgress(prev => ({
        ...prev,
        [fileId]: {
          ...prev[fileId],
          status: 'error',
          error: errorMessage,
        },
      }));

      console.error('Error uploading file:', error);
      return null;
    }
  };

  const deleteFile = async (storagePath: string, bucket: StorageBucket = 'centro-copiado-archivos'): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([storagePath]);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  };

  const getPublicUrl = (storagePath: string, bucket: StorageBucket = 'centro-copiado-archivos'): string => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    return data.publicUrl;
  };

  const createSignedUrl = async (storagePath: string, bucket: StorageBucket = 'centro-copiado-archivos', expiresIn = 3600): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);

      if (error) throw error;
      return data.signedUrl;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  };

  const downloadFile = async (storagePath: string, fileName: string, bucket: StorageBucket = 'centro-copiado-archivos'): Promise<boolean> => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .download(storagePath);

      if (error) {
        throw error;
      }

      // Crear URL temporal y descargar
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Error downloading file:', error);
      return false;
    }
  };

  const clearProgress = (fileId: string) => {
    setUploadProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[fileId];
      return newProgress;
    });
  };

  const clearAllProgress = () => {
    setUploadProgress({});
  };

  return {
    uploadFile,
    deleteFile,
    getPublicUrl,
    createSignedUrl,
    downloadFile,
    uploadProgress,
    clearProgress,
    clearAllProgress,
  };
}

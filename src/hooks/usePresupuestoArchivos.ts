import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type {
  PresupuestoArchivo,
  CreatePresupuestoArchivoData,
} from '../types/presupuestos';

export function usePresupuestoArchivos(presupuestoId: string | undefined) {
  const { user } = useAuth();
  const [archivos, setArchivos] = useState<PresupuestoArchivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presupuestoId) {
      fetchArchivos();
    } else {
      setArchivos([]);
      setLoading(false);
    }
  }, [presupuestoId]);

  const fetchArchivos = async () => {
    if (!presupuestoId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('presupuestos_archivos')
        .select('*')
        .eq('presupuesto_id', presupuestoId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setArchivos((data as PresupuestoArchivo[]) || []);
    } catch (err: any) {
      console.error('Error fetching archivos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const uploadArchivo = async (
    file: File,
    descripcion?: string
  ): Promise<PresupuestoArchivo | null> => {
    if (!presupuestoId || !user) return null;

    try {
      setError(null);

      // Obtener company_id del usuario
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('No se pudo obtener company_id');

      const companyId = profile.company_id;

      // Generar nombre único para storage
      const timestamp = Date.now();
      const nombreStorage = `${timestamp}-${file.name}`;
      const storagePath = `${companyId}/${presupuestoId}/${nombreStorage}`;

      // Subir a storage
      const { error: uploadError } = await supabase.storage
        .from('presupuestos-archivos')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Crear registro en base de datos
      const archivoData: CreatePresupuestoArchivoData = {
        presupuesto_id: presupuestoId,
        nombre_archivo: file.name,
        nombre_storage: nombreStorage,
        tipo_mime: file.type,
        tamano_bytes: file.size,
        storage_path: storagePath,
        descripcion,
      };

      const { data: newArchivo, error: createError } = await supabase
        .from('presupuestos_archivos')
        .insert({
          ...archivoData,
          company_id: companyId,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      await fetchArchivos();
      return newArchivo as PresupuestoArchivo;
    } catch (err: any) {
      console.error('Error uploading archivo:', err);
      setError(err.message);
      return null;
    }
  };

  const deleteArchivo = async (id: string): Promise<boolean> => {
    try {
      setError(null);

      // Obtener info del archivo
      const archivo = archivos.find((a) => a.id === id);
      if (!archivo) throw new Error('Archivo no encontrado');

      // Eliminar de storage
      const { error: storageError } = await supabase.storage
        .from('presupuestos-archivos')
        .remove([archivo.storage_path]);

      if (storageError) throw storageError;

      // Eliminar de base de datos
      const { error: deleteError } = await supabase
        .from('presupuestos_archivos')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      await fetchArchivos();
      return true;
    } catch (err: any) {
      console.error('Error deleting archivo:', err);
      setError(err.message);
      return false;
    }
  };

  const updateDescripcion = async (
    id: string,
    descripcion: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('presupuestos_archivos')
        .update({ descripcion })
        .eq('id', id);

      if (updateError) throw updateError;

      await fetchArchivos();
      return true;
    } catch (err: any) {
      console.error('Error updating descripcion:', err);
      setError(err.message);
      return false;
    }
  };

  const getDownloadUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error: urlError } = await supabase.storage
        .from('presupuestos-archivos')
        .createSignedUrl(storagePath, 3600); // 1 hora

      if (urlError) throw urlError;

      return data.signedUrl;
    } catch (err: any) {
      console.error('Error getting download url:', err);
      return null;
    }
  };

  const downloadArchivo = async (archivo: PresupuestoArchivo): Promise<void> => {
    try {
      const url = await getDownloadUrl(archivo.storage_path);
      if (!url) throw new Error('No se pudo obtener URL de descarga');

      // Abrir en nueva pestaña
      window.open(url, '_blank');
    } catch (err: any) {
      console.error('Error downloading archivo:', err);
      setError(err.message);
    }
  };

  // Gestión de archivos temporales (antes de crear presupuesto)
  const uploadArchivoTemporal = async (
    file: File,
    temporalId: string,
    descripcion?: string
  ): Promise<PresupuestoArchivo | null> => {
    if (!user) return null;

    try {
      setError(null);

      // Obtener company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) throw new Error('No se pudo obtener company_id');

      const companyId = profile.company_id;

      // Generar nombre único
      const timestamp = Date.now();
      const nombreStorage = `${timestamp}-${file.name}`;
      const storagePath = `${companyId}/temporal/${temporalId}/${nombreStorage}`;

      // Subir a storage
      const { error: uploadError } = await supabase.storage
        .from('presupuestos-archivos')
        .upload(storagePath, file);

      if (uploadError) throw uploadError;

      // Crear registro temporal
      const { data: newArchivo, error: createError } = await supabase
        .from('presupuestos_archivos')
        .insert({
          company_id: companyId,
          presupuesto_temporal_id: temporalId,
          temporal_creado_en: new Date().toISOString(),
          nombre_archivo: file.name,
          nombre_storage: nombreStorage,
          tipo_mime: file.type,
          tamano_bytes: file.size,
          storage_path: storagePath,
          descripcion,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (createError) throw createError;

      return newArchivo as PresupuestoArchivo;
    } catch (err: any) {
      console.error('Error uploading archivo temporal:', err);
      setError(err.message);
      return null;
    }
  };

  const asociarArchivosTemporales = async (
    temporalId: string,
    presupuestoId: string
  ): Promise<boolean> => {
    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('presupuestos_archivos')
        .update({
          presupuesto_id: presupuestoId,
          presupuesto_temporal_id: null,
          temporal_creado_en: null,
        })
        .eq('presupuesto_temporal_id', temporalId);

      if (updateError) throw updateError;

      return true;
    } catch (err: any) {
      console.error('Error asociando archivos temporales:', err);
      setError(err.message);
      return false;
    }
  };

  const limpiarArchivosTemporales = async (temporalId: string): Promise<boolean> => {
    try {
      // Obtener archivos temporales
      const { data: temporales } = await supabase
        .from('presupuestos_archivos')
        .select('*')
        .eq('presupuesto_temporal_id', temporalId);

      if (!temporales || temporales.length === 0) return true;

      // Eliminar de storage
      const paths = temporales.map((a: any) => a.storage_path);
      await supabase.storage.from('presupuestos-archivos').remove(paths);

      // Eliminar de base de datos
      await supabase
        .from('presupuestos_archivos')
        .delete()
        .eq('presupuesto_temporal_id', temporalId);

      return true;
    } catch (err: any) {
      console.error('Error limpiando archivos temporales:', err);
      return false;
    }
  };

  return {
    archivos,
    loading,
    error,
    refetch: fetchArchivos,
    uploadArchivo,
    deleteArchivo,
    updateDescripcion,
    getDownloadUrl,
    downloadArchivo,
    uploadArchivoTemporal,
    asociarArchivosTemporales,
    limpiarArchivosTemporales,
  };
}

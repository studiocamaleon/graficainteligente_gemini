import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

interface UploadLogoResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface DeleteLogoResult {
  success: boolean;
  error?: string;
}

export function useCompanyLogo() {
  const { company, profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManageLogo = profile?.role === 'super_admin' || profile?.role === 'admin';

  const validateFile = (file: File): string | null => {
    const MAX_SIZE = 2 * 1024 * 1024;
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-icon', 'image/vnd.microsoft.icon'];

    if (file.size > MAX_SIZE) {
      return 'El archivo es demasiado grande. El tamaño máximo es 2MB.';
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato de archivo no permitido. Solo se aceptan PNG, JPG, JPEG e ICO.';
    }

    return null;
  };

  const uploadLogo = async (file: File): Promise<UploadLogoResult> => {
    if (!company) {
      return { success: false, error: 'No hay empresa activa' };
    }

    if (!canManageLogo) {
      return { success: false, error: 'No tienes permisos para gestionar el logo' };
    }

    const validationError = validateFile(file);
    if (validationError) {
      return { success: false, error: validationError };
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${company.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading logo:', uploadError);
        return { success: false, error: 'Error al subir el logo' };
      }

      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(fileName);

      const logoUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: logoUrl })
        .eq('id', company.id);

      if (updateError) {
        console.error('Error updating company logo URL:', updateError);
        return { success: false, error: 'Error al actualizar el logo en la base de datos' };
      }

      return { success: true, url: logoUrl };
    } catch (error) {
      console.error('Unexpected error uploading logo:', error);
      return { success: false, error: 'Error inesperado al subir el logo' };
    } finally {
      setIsUploading(false);
    }
  };

  const deleteLogo = async (): Promise<DeleteLogoResult> => {
    if (!company) {
      return { success: false, error: 'No hay empresa activa' };
    }

    if (!canManageLogo) {
      return { success: false, error: 'No tienes permisos para gestionar el logo' };
    }

    if (!company.logo_url) {
      return { success: true };
    }

    setIsDeleting(true);

    try {
      const fileName = `${company.id}/logo`;

      const { data: listData, error: listError } = await supabase.storage
        .from('company-logos')
        .list(company.id);

      if (listError) {
        console.error('Error listing files:', listError);
        return { success: false, error: 'Error al listar archivos' };
      }

      if (listData && listData.length > 0) {
        const filesToDelete = listData.map(file => `${company.id}/${file.name}`);

        const { error: deleteError } = await supabase.storage
          .from('company-logos')
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Error deleting logo files:', deleteError);
          return { success: false, error: 'Error al eliminar el logo' };
        }
      }

      const { error: updateError } = await supabase
        .from('companies')
        .update({ logo_url: null })
        .eq('id', company.id);

      if (updateError) {
        console.error('Error updating company logo URL:', updateError);
        return { success: false, error: 'Error al actualizar la base de datos' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error deleting logo:', error);
      return { success: false, error: 'Error inesperado al eliminar el logo' };
    } finally {
      setIsDeleting(false);
    }
  };

  const getLogoUrl = (): string | null => {
    return company?.logo_url || null;
  };

  return {
    uploadLogo,
    deleteLogo,
    getLogoUrl,
    isUploading,
    isDeleting,
    canManageLogo,
  };
}

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Provider, ProviderFormData } from '../types/database';

export function useProvider() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProvider = async (id: string): Promise<Provider | null> => {
    if (!profile?.company_id) {
      setError('No hay una empresa asociada');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('providers')
        .select('*')
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      return data;
    } catch (err) {
      console.error('Error fetching provider:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar el proveedor');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createProvider = async (formData: ProviderFormData): Promise<Provider | null> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay una empresa o usuario asociado');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const providerData = {
        company_id: profile.company_id,
        nombre_fantasia: formData.nombre_fantasia,
        razon_social: formData.razon_social,
        tipo_documento: formData.tipo_documento,
        numero_documento: formData.numero_documento,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        domicilio: formData.domicilio || null,
        country_id: formData.country_id || null,
        province_id: formData.province_id || null,
        city_id: formData.city_id || null,
        codigo_postal: formData.codigo_postal || null,
        banco: formData.banco || null,
        tipo_cuenta: formData.tipo_cuenta || null,
        tipo_identificador_bancario: formData.tipo_identificador_bancario || null,
        identificador_bancario: formData.identificador_bancario || null,
        acepta_transferencias: formData.acepta_transferencias,
        acepta_cheques: formData.acepta_cheques,
        acepta_tarjetas_credito: formData.acepta_tarjetas_credito,
        acepta_otros: formData.acepta_otros,
        created_by: profile.id,
        is_active: true,
      };

      const { data, error: insertError } = await supabase
        .from('providers')
        .insert(providerData)
        .select()
        .single();

      if (insertError) throw insertError;

      return data;
    } catch (err) {
      console.error('Error creating provider:', err);
      setError(err instanceof Error ? err.message : 'Error al crear el proveedor');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateProvider = async (
    id: string,
    formData: ProviderFormData
  ): Promise<Provider | null> => {
    if (!profile?.company_id || !profile?.id) {
      setError('No hay una empresa o usuario asociado');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const providerData = {
        nombre_fantasia: formData.nombre_fantasia,
        razon_social: formData.razon_social,
        tipo_documento: formData.tipo_documento,
        numero_documento: formData.numero_documento,
        whatsapp: formData.whatsapp || null,
        email: formData.email || null,
        domicilio: formData.domicilio || null,
        country_id: formData.country_id || null,
        province_id: formData.province_id || null,
        city_id: formData.city_id || null,
        codigo_postal: formData.codigo_postal || null,
        banco: formData.banco || null,
        tipo_cuenta: formData.tipo_cuenta || null,
        tipo_identificador_bancario: formData.tipo_identificador_bancario || null,
        identificador_bancario: formData.identificador_bancario || null,
        acepta_transferencias: formData.acepta_transferencias,
        acepta_cheques: formData.acepta_cheques,
        acepta_tarjetas_credito: formData.acepta_tarjetas_credito,
        acepta_otros: formData.acepta_otros,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error: updateError } = await supabase
        .from('providers')
        .update(providerData)
        .eq('id', id)
        .eq('company_id', profile.company_id)
        .select()
        .single();

      if (updateError) throw updateError;

      return data;
    } catch (err) {
      console.error('Error updating provider:', err);
      setError(err instanceof Error ? err.message : 'Error al actualizar el proveedor');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggleProviderStatus = async (id: string, currentStatus: boolean): Promise<boolean> => {
    if (!profile?.company_id) {
      setError('No hay una empresa asociada');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('providers')
        .update({
          is_active: !currentStatus,
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      console.error('Error toggling provider status:', err);
      setError(err instanceof Error ? err.message : 'Error al cambiar el estado del proveedor');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    getProvider,
    createProvider,
    updateProvider,
    toggleProviderStatus,
  };
}

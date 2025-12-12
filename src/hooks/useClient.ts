import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { Client } from '../types/database';

type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by' | 'company_id'>;
type ClientUpdate = Partial<ClientInput>;

export function useClient() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createClient = async (clientData: ClientInput): Promise<Client | null> => {
    if (!profile?.company_id) {
      setError('No se encontró la empresa del usuario');
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const sanitizedData = {
        ...clientData,
        country_id: clientData.country_id || null,
        province_id: clientData.province_id || null,
        city_id: clientData.city_id || null,
        app_pin: clientData.app_pin || null,
        company_id: profile.company_id,
      };

      const { data, error: createError } = await supabase
        .from('clients')
        .insert(sanitizedData)
        .select()
        .single();

      if (createError) throw createError;

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear cliente';
      setError(errorMessage);
      console.error('Error creating client:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateClient = async (clientId: string, clientData: ClientUpdate): Promise<Client | null> => {
    try {
      setLoading(true);
      setError(null);

      const sanitizedData = {
        ...clientData,
        country_id: clientData.country_id || null,
        province_id: clientData.province_id || null,
        province_id: clientData.province_id || null,
        city_id: clientData.city_id || null,
        app_pin: clientData.app_pin || null,
      };

      const { data, error: updateError } = await supabase
        .from('clients')
        .update(sanitizedData)
        .eq('id', clientId)
        .select()
        .single();

      if (updateError) throw updateError;

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar cliente';
      setError(errorMessage);
      console.error('Error updating client:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (clientId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (deleteError) throw deleteError;

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar cliente';
      setError(errorMessage);
      console.error('Error deleting client:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const toggleClientStatus = async (clientId: string, currentStatus: boolean): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('clients')
        .update({ is_active: !currentStatus })
        .eq('id', clientId);

      if (updateError) throw updateError;

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado del cliente';
      setError(errorMessage);
      console.error('Error toggling client status:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getClient = async (clientId: string): Promise<Client | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (fetchError) throw fetchError;

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener cliente';
      setError(errorMessage);
      console.error('Error fetching client:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createClient,
    updateClient,
    deleteClient,
    toggleClientStatus,
    getClient,
  };
}

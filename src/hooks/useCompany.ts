import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useLocations } from './useLocations';
import type { CompanyFormData } from '../types/database';

export function useCompany() {
  const { company, profile, updateCompany } = useAuth();
  const { countries, provinces, cities, loadProvinces, loadCities } = useLocations();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = profile?.role === 'super_admin' || profile?.role === 'admin';

  const getInitialFormData = (): CompanyFormData => {
    return {
      name: company?.name || '',
      logo_url: company?.logo_url || '',
      contact_phone: company?.contact_phone || '',
      contact_email: company?.contact_email || '',
      website: company?.website || '',
      address: company?.address || '',
      country_id: company?.country_id || '',
      province_id: company?.province_id || '',
      city_id: company?.city_id || '',
      postal_code: company?.postal_code || '',
      legal_name: company?.legal_name || '',
      tax_id_type: company?.tax_id_type || '',
      tax_id_number: company?.tax_id_number || '',
      tax_condition: company?.tax_condition || '',
      timezone: company?.timezone || 'America/Argentina/Buenos_Aires',
      currency: company?.currency || 'ARS',
      language: company?.language || 'es',
      description: company?.description || '',
      industry: company?.industry || '',
    };
  };

  useEffect(() => {
    if (company?.country_id) {
      loadProvinces(company.country_id);
    }
  }, [company?.country_id]);

  useEffect(() => {
    if (company?.province_id) {
      loadCities(company.province_id);
    }
  }, [company?.province_id]);

  const handleUpdate = async (data: Partial<CompanyFormData>) => {
    if (!canEdit) {
      throw new Error('No tienes permisos para actualizar la empresa');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updateData: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (value === '') {
          updateData[key] = null;
        } else if (value !== undefined) {
          updateData[key] = value;
        }
      });

      await updateCompany(updateData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar la empresa';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    company,
    canEdit,
    isLoading,
    error,
    countries,
    provinces,
    cities,
    loadProvinces,
    loadCities,
    getInitialFormData,
    handleUpdate,
  };
}

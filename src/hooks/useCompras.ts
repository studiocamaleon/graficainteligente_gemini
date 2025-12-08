import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useToast } from '../contexts/ToastContext';

export interface CompraProveedor {
    id: string;
    company_id: string;
    provider_id: string | null;
    descripcion: string;
    numero_factura: string | null;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
    archivo_url: string | null;
    estado: 'pendiente' | 'parcial' | 'pagado';
    notas: string | null;
    created_at: string;
    proveedor?: {
        nombre_fantasia: string;
        razon_social: string;
    };
}

export interface CreateCompraData {
    provider_id?: string;
    descripcion: string;
    numero_factura?: string;
    monto_total: number;
    fecha_emision: string;
    fecha_vencimiento: string;
    notas?: string;
    archivo?: File;
}

export function useCompras() {
    const { company, user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [loading, setLoading] = useState(false);

    const crearCompra = async (data: CreateCompraData) => {
        if (!company || !user) return;

        try {
            setLoading(true);

            let archivoUrl = null;

            // Upload file if exists
            if (data.archivo) {
                const fileExt = data.archivo.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${company.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('comprobantes') // Assuming this bucket exists or we need to create it? We should check buckets.
                    .upload(filePath, data.archivo);

                if (uploadError) throw uploadError;

                // Get public URL? Or signed? Let's assume public/signed retrieval later.
                // For simplicity, store path.
                archivoUrl = filePath;
            }

            const { error } = await supabase
                .from('compras_proveedores')
                .insert({
                    company_id: company.id,
                    created_by: user.id,
                    provider_id: data.provider_id || null,
                    descripcion: data.descripcion,
                    numero_factura: data.numero_factura || null,
                    monto_total: data.monto_total,
                    fecha_emision: data.fecha_emision,
                    fecha_vencimiento: data.fecha_vencimiento,
                    notas: data.notas || null,
                    archivo_url: archivoUrl,
                    estado: 'pendiente'
                });

            if (error) throw error;

            showSuccess('Compra registrada correctamente');
        } catch (error: any) {
            console.error('Error creating compra:', error);
            showError(error.message || 'Error al registrar la compra');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    return {
        crearCompra,
        loading
    };
}

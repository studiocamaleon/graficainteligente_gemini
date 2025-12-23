export interface CentroCopiadoRutaConfig {
    id: string;
    company_id: string;
    clave: string;
    valor: string | null;
    paso_id: string;
    created_at: string;
    updated_at: string;
    paso?: {
        id: string;
        nombre: string;
    };
}

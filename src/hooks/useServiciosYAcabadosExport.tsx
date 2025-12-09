import { useState, useCallback } from 'react';
import { usePDFExport } from './usePDFExport';
import { ServiciosYAcabadosPDFTemplate } from '../components/pdf/templates/ServiciosYAcabadosPDFTemplate';

export function useServiciosYAcabadosExport() {
    const [isPreparing, setIsPreparing] = useState(false);

    // Fetch ALL data (large limit) when needed
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = useCallback(async () => {
        try {
            setIsExporting(true);

            // 1. Fetch Data
            const { supabase } = await import('../lib/supabase');

            const { data: serviciosData } = await supabase
                .from('servicios')
                .select(`
                    *,
                    estacion:estaciones_trabajo(id, nombre),
                    niveles_precio:servicios_niveles_precio(*)
                `)
                .eq('is_active', true)
                .order('nombre');

            const { data: acabadosData } = await supabase
                .from('acabados')
                .select(`
                    *,
                    estacion:estaciones_trabajo(id, nombre),
                    niveles_precio:acabados_niveles_precio(*)
                `)
                .eq('is_active', true)
                .order('nombre');

            const servicios = serviciosData || [];
            const acabados = acabadosData || [];

            // 2. Initialize PDF
            const doc = new jsPDF();

            // Title
            doc.setFontSize(18);
            doc.text('Lista de Precios - Servicios y Acabados', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, 14, 28);

            let finalY = 35; // Start position

            // 3. Table: Servicios
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text('Servicios', 14, finalY);
            finalY += 6;

            const serviciosRows = servicios.map((item: any) => {
                let precioText = '';
                if (item.tiene_niveles_precio && item.niveles_precio?.length > 0) {
                    precioText = item.niveles_precio
                        .sort((a: any, b: any) => a.orden - b.orden)
                        .map((n: any) => `${n.nombre}: ${formatImpactoForTable(n.tipo_impacto, n.valor_impacto, n.valor_impacto_secundario)}`)
                        .join('\n');
                } else {
                    precioText = formatImpactoForTable(item.tipo_impacto, item.valor_impacto, item.valor_impacto_secundario);
                }

                return [
                    item.nombre,
                    item.estacion?.nombre || '-',
                    precioText
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['Nombre', 'Estación', 'Regla de Precio / Impacto']],
                body: serviciosRows,
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] }, // Indigo 500 equivalent
                styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60 }, // Nombre
                    1: { cellWidth: 40 }, // Estacion
                    2: { cellWidth: 'auto' } // Precio
                }
            });

            finalY = (doc as any).lastAutoTable.finalY + 15;

            // 4. Table: Acabados
            doc.setFontSize(14);
            doc.text('Acabados', 14, finalY);
            finalY += 6;

            const acabadosRows = acabados.map((item: any) => {
                let precioText = '';
                if (item.tiene_niveles_precio && item.niveles_precio?.length > 0) {
                    precioText = item.niveles_precio
                        .sort((a: any, b: any) => a.orden - b.orden)
                        .map((n: any) => `${n.nombre}: ${formatImpactoForTable(n.tipo_impacto, n.valor_impacto, n.valor_impacto_secundario)}`)
                        .join('\n');
                } else {
                    precioText = formatImpactoForTable(item.tipo_impacto, item.valor_impacto, item.valor_impacto_secundario);
                }

                return [
                    item.nombre,
                    item.estacion?.nombre || '-',
                    precioText
                ];
            });

            autoTable(doc, {
                startY: finalY,
                head: [['Nombre', 'Estación', 'Regla de Precio / Impacto']],
                body: acabadosRows,
                theme: 'grid',
                headStyles: { fillColor: [225, 29, 72] }, // Rose 600 equivalent
                styles: { fontSize: 10, cellPadding: 4, valign: 'middle' },
                columnStyles: {
                    0: { fontStyle: 'bold', cellWidth: 60 }, // Nombre
                    1: { cellWidth: 40 }, // Estacion
                    2: { cellWidth: 'auto' } // Precio
                }
            });

            // 5. Save
            doc.save(`lista-precios-servicios-acabados-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    }, []);

    return {
        handleExport,
        isExporting
    };
}

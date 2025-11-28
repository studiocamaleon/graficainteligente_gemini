import type { TipoEtapaRuta } from '../types/database';

export const ORDEN_ETAPAS: Record<TipoEtapaRuta, number> = {
  pre_prensa: 1,
  principal: 2,
  post_prensa: 3,
  instalacion: 4,
};

export interface RutaOrdenable {
  tipo_etapa: TipoEtapaRuta;
  orden: number;
  [key: string]: any;
}

export const ordenarRutasPorEtapaYOrden = <T extends RutaOrdenable>(rutas: T[]): T[] => {
  return [...rutas].sort((a, b) => {
    const ordenEtapaA = ORDEN_ETAPAS[a.tipo_etapa];
    const ordenEtapaB = ORDEN_ETAPAS[b.tipo_etapa];

    if (ordenEtapaA !== ordenEtapaB) {
      return ordenEtapaA - ordenEtapaB;
    }

    return a.orden - b.orden;
  });
};

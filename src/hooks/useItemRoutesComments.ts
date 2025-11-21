interface UseItemRoutesCommentsParams {
  items: any[];
  setItems: (items: any[]) => void;
}

export function useItemRoutesComments({ items, setItems }: UseItemRoutesCommentsParams) {
  const updateStepComment = (
    itemIndex: number,
    stepId: string,
    comentario: string | null
  ) => {
    const newItems = [...items];
    const item = newItems[itemIndex];

    if (item.rutas_generadas) {
      item.rutas_generadas = item.rutas_generadas.map((ruta: any) => {
        if (ruta.id === stepId) {
          return { ...ruta, comentario_vendedor: comentario };
        }
        return ruta;
      });
    }

    setItems(newItems);
  };

  const getStepComment = (itemIndex: number, stepId: string): string | null => {
    const item = items[itemIndex];
    if (!item?.rutas_generadas) return null;

    const ruta = item.rutas_generadas.find((r: any) => r.id === stepId);
    return ruta?.comentario_vendedor || null;
  };

  const countItemComments = (itemIndex: number): number => {
    const item = items[itemIndex];
    if (!item?.rutas_generadas) return 0;

    return item.rutas_generadas.filter(
      (r: any) => r.comentario_vendedor && r.comentario_vendedor.trim().length > 0
    ).length;
  };

  const countAllComments = (): number => {
    return items.reduce((total, _, index) => total + countItemComments(index), 0);
  };

  return {
    updateStepComment,
    getStepComment,
    countItemComments,
    countAllComments,
  };
}

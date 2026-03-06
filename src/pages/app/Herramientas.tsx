import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Sticker, Wrench } from 'lucide-react';
import { usePageHeader } from '../../hooks/usePageHeader';
import { StickerSheetCalculator } from '../../components/tools/StickerSheetCalculator';
import { Tabs } from '../../components/ui/Tabs';

type ToolDefinition = {
  id: string;
  name: string;
  description: string;
  icon: typeof Wrench;
  render: () => JSX.Element;
};

export function Herramientas() {
  usePageHeader('Herramientas');
  const [searchParams, setSearchParams] = useSearchParams();

  const tools = useMemo<ToolDefinition[]>(
    () => [
      {
        id: 'stickers-pliego',
        name: 'Stickers en Pliego',
        description: 'Calculá cuántos stickers entran en el área útil del pliego troquelado.',
        icon: Sticker,
        render: () => <StickerSheetCalculator />,
      },
    ],
    []
  );

  const selectedToolId = searchParams.get('tool');
  const selectedTool = tools.find((tool) => tool.id === selectedToolId) || null;

  const tabs = [
    { id: 'inicio', label: 'Inicio', icon: LayoutGrid },
    ...tools.map((tool) => ({ id: tool.id, label: tool.name, icon: tool.icon })),
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Herramientas internas</p>
            <h1 className="truncate text-xl font-bold text-slate-900">
              {selectedTool ? selectedTool.name : 'Seleccioná una herramienta'}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Mini utilidades internas para resolver tareas rápidas del equipo.
        </p>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={selectedTool ? selectedTool.id : 'inicio'}
        onChange={(tabId) => {
          const nextParams = new URLSearchParams(searchParams);
          if (tabId === 'inicio') {
            nextParams.delete('tool');
          } else {
            nextParams.set('tool', tabId);
          }
          setSearchParams(nextParams, { replace: true });
        }}
      />

      {!selectedTool && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.set('tool', tool.id);
                  setSearchParams(nextParams, { replace: true });
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{tool.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-slate-600">{tool.description}</p>
              </button>
            );
          })}
        </div>
      )}

      {selectedTool && selectedTool.render()}
    </div>
  );
}

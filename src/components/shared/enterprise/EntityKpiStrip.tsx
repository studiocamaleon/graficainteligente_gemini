import { Card, CardContent } from '../../ui/card';

interface EntityKpiItem {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

interface EntityKpiStripProps {
  items: EntityKpiItem[];
}

export function EntityKpiStrip({ items }: EntityKpiStripProps) {
  const isDense = items.length >= 5;

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${isDense ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
      {items.map((item) => (
        <Card key={item.id} className="border-slate-200 shadow-sm">
          <CardContent className={isDense ? 'p-3' : 'p-4'}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={isDense ? 'mt-1 text-lg font-semibold text-slate-900' : 'mt-1 text-2xl font-semibold text-slate-900'}>
              {item.value}
            </p>
            {item.hint ? <p className="mt-1 text-xs text-slate-500">{item.hint}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

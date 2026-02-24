import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { useReglasInternasAck, useReglasInternasPendientes } from '../../hooks/useReglasInternas';

export function ReglasInternasMandatoryModal() {
  const { pendientes, loading, error, refetch } = useReglasInternasPendientes();
  const { confirmRegla, loading: confirming, error: confirmError } = useReglasInternasAck();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const isOpen = !loading && pendientes.length > 0;
  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const allSelected = pendientes.length > 0 && selectedCount === pendientes.length;
  const progress = pendientes.length > 0 ? Math.round((selectedCount / pendientes.length) * 100) : 0;

  const toggleItem = (id: string) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleConfirmAll = async () => {
    if (!allSelected || confirming) return;

    for (const regla of pendientes) {
      const ok = await confirmRegla(regla.regla_id, regla.version_publicada);
      if (!ok) return;
    }

    setSelected({});
    await refetch();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Confirmación obligatoria de reglas"
      size="lg"
      showCloseButton={false}
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white/10 p-2.5 text-amber-300 ring-1 ring-white/20">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-slate-100">
                  Cumplimiento de reglas internas
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  Debés confirmar lectura para continuar
                </h3>
                <p className="mt-1 text-sm text-slate-200">
                  Esta validación se solicita una vez por cada versión publicada de reglas críticas.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 ring-1 ring-white/20">
              {selectedCount}/{pendientes.length} confirmadas
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-200">
              <span>Progreso de confirmación</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-300 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </section>

        {error ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>
        ) : null}

        {confirmError ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{confirmError}</Card>
        ) : null}

        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
          {pendientes.map((regla) => (
            <article
              key={regla.regla_id}
              className={`rounded-2xl border p-4 shadow-sm transition-all ${
                selected[regla.regla_id]
                  ? 'border-emerald-300 bg-emerald-50/70'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold text-slate-900">{regla.titulo}</h3>
                <Badge variant="danger" size="sm" className="font-semibold">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Crítica
                </Badge>
                <Badge variant="info" size="sm" className="font-semibold">
                  Versión {regla.version_publicada}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{regla.contenido}</p>

              <label
                className={`mt-3 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  selected[regla.regla_id]
                    ? 'border-emerald-300 bg-emerald-100/80 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(selected[regla.regla_id])}
                  onChange={() => toggleItem(regla.regla_id)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Confirmo que leí y entendí esta regla.
              </label>
            </article>
          ))}
        </div>

        <footer className="sticky bottom-0 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Estado: <span className="font-semibold text-slate-900">{selectedCount} de {pendientes.length}</span> reglas confirmadas.
            </p>
            <Button onClick={handleConfirmAll} disabled={!allSelected} isLoading={confirming}>
              <CheckCircle2 className="h-4 w-4" />
              Confirmar y continuar
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}

import { Link } from 'react-router-dom';
import { AlertTriangle, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { formatDateTimeDisplay } from '../../../utils/dates';
import { useReglasInternas, useReglasInternasAdmin } from '../../../hooks/useReglasInternas';

export default function DocumentationReglasInternasPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const { grouped, loading, error } = useReglasInternas();
  const { ackViews } = useReglasInternasAdmin();
  const [search, setSearch] = useState('');

  const acksByRuleVersion = useMemo(() => {
    const map = new Map<string, typeof ackViews>();
    ackViews.forEach((ack) => {
      const key = `${ack.regla_id}:${ack.regla_version}`;
      const current = map.get(key) || [];
      current.push(ack);
      map.set(key, current);
    });
    return map;
  }, [ackViews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grouped;

    return grouped
      .map((section) => ({
        ...section,
        reglas: section.reglas.filter((r) =>
          `${r.titulo} ${r.contenido} ${section.nombre}`.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.reglas.length > 0);
  }, [grouped, search]);

  return (
    <DocumentationLayout
      title="Reglas internas"
      description="Procedimientos y acuerdos operativos para que todo el equipo trabaje con criterios unificados."
    >
      <div className="space-y-4">
        <Card className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por palabra clave..."
                className="pl-10"
              />
            </div>

            {isAdmin ? (
              <Link to="/app/documentacion/reglas-internas/admin">
                <Button>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Gestionar reglas
                </Button>
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Las reglas marcadas como críticas pueden requerir confirmación de lectura según tu rol.
          </p>
        </Card>

        {loading ? (
          <Card className="p-6 text-sm text-slate-600">Cargando reglas internas...</Card>
        ) : error ? (
          <Card className="border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</Card>
        ) : filtered.length === 0 ? (
          <Card className="p-6 text-sm text-slate-600">No hay reglas publicadas para mostrar.</Card>
        ) : (
          filtered.map((section) => (
            <Card key={section.id} className="p-5">
              <div className="mb-3 border-b border-slate-200 pb-3">
                <h3 className="text-lg font-semibold text-slate-900">{section.nombre}</h3>
                {section.descripcion ? (
                  <p className="mt-1 text-sm text-slate-600">{section.descripcion}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                {section.reglas.map((regla) => (
                  <article key={regla.regla_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="font-semibold text-slate-900">{regla.titulo}</h4>
                      {regla.es_critica ? (
                        <Badge variant="warning">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Crítica
                        </Badge>
                      ) : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{regla.contenido}</p>

                    {isAdmin ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Confirmaciones lectura (v{regla.version_publicada})
                          </p>
                          <Badge variant="info" size="sm">
                            {(acksByRuleVersion.get(`${regla.regla_id}:${regla.version_publicada}`) || []).length} confirmaciones
                          </Badge>
                        </div>

                        {(acksByRuleVersion.get(`${regla.regla_id}:${regla.version_publicada}`) || []).length === 0 ? (
                          <p className="text-xs text-slate-500">Sin confirmaciones registradas para esta versión.</p>
                        ) : (
                          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                            {(acksByRuleVersion.get(`${regla.regla_id}:${regla.version_publicada}`) || []).map((ack) => (
                              <div key={ack.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                <p className="text-xs text-slate-700">
                                  <span className="font-medium">{ack.usuario_nombre}</span> · {ack.usuario_role}
                                </p>
                                <p className="text-xs text-slate-500">{formatDateTimeDisplay(ack.ack_at)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </DocumentationLayout>
  );
}

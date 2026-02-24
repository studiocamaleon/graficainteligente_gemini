import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Save, UploadCloud } from 'lucide-react';
import { DocumentationLayout } from '../../../components/documentation/DocumentationLayout';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Textarea } from '../../../components/ui/Textarea';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { useAuth } from '../../../hooks/useAuth';
import { useReglasInternasAdmin } from '../../../hooks/useReglasInternas';
import { formatDateTimeDisplay } from '../../../utils/dates';

const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'operador_diseno', label: 'Operador Diseño' },
  { value: 'operador_taller', label: 'Operador Taller' },
  { value: 'viewer', label: 'Viewer' },
];

export default function DocumentationReglasInternasAdminPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const {
    canManage,
    secciones,
    items,
    ackViews,
    loading,
    error,
    createSeccion,
    updateSeccion,
    createRegla,
    updateRegla,
    publishRegla,
  } = useReglasInternasAdmin();

  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionDesc, setNewSectionDesc] = useState('');

  const [formSeccionId, setFormSeccionId] = useState('');
  const [formTitulo, setFormTitulo] = useState('');
  const [formContenido, setFormContenido] = useState('');
  const [formCritica, setFormCritica] = useState(false);
  const [formRoles, setFormRoles] = useState<string[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; reglas: typeof items }>();
    secciones.forEach((sec) => map.set(sec.id, { id: sec.id, nombre: sec.nombre, reglas: [] }));

    items.forEach((item) => {
      const sec = map.get(item.seccion_id);
      if (sec) sec.reglas.push(item);
    });

    return Array.from(map.values()).map((sec) => ({
      ...sec,
      reglas: sec.reglas.sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo)),
    }));
  }, [secciones, items]);

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

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) return;
    const ok = await createSeccion({ nombre: newSectionName.trim(), descripcion: newSectionDesc.trim() || null });
    if (ok) {
      setNewSectionName('');
      setNewSectionDesc('');
    }
  };

  const handleCreateRule = async () => {
    if (!formSeccionId || !formTitulo.trim() || !formContenido.trim()) return;
    const ok = await createRegla({
      seccion_id: formSeccionId,
      titulo: formTitulo.trim(),
      contenido: formContenido.trim(),
      es_critica: formCritica,
      aplica_roles: formRoles.length > 0 ? formRoles : null,
    });
    if (ok) {
      setFormTitulo('');
      setFormContenido('');
      setFormCritica(false);
      setFormRoles([]);
    }
  };

  const toggleRole = (role: string) => {
    setFormRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  if (!isAdmin || !canManage) {
    return (
      <DocumentationLayout title="Reglas internas" description="No tenés permisos para gestionar reglas internas.">
        <Card className="p-6 text-sm text-slate-700">Este panel es exclusivo para admin y superadmin.</Card>
      </DocumentationLayout>
    );
  }

  return (
    <DocumentationLayout
      title="Gestión de reglas internas"
      description="Administrá secciones y reglas. Publicar una regla crítica puede exigir confirmación al equipo."
    >
      <div className="space-y-4">
        <div>
          <Link to="/app/documentacion/reglas-internas">
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a lectura
            </Button>
          </Link>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Nueva sección</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Nombre"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              placeholder="Ej: Producción"
            />
            <Input
              label="Descripción"
              value={newSectionDesc}
              onChange={(e) => setNewSectionDesc(e.target.value)}
              placeholder="Uso diario en taller"
            />
            <div className="flex items-end">
              <Button onClick={handleCreateSection} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Crear sección
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Nueva regla</h3>
          <div className="space-y-3">
            <Select label="Sección" value={formSeccionId} onChange={setFormSeccionId}>
              <option value="">Seleccionar sección...</option>
              {secciones.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </Select>

            <Input
              label="Título"
              value={formTitulo}
              onChange={(e) => setFormTitulo(e.target.value)}
              placeholder="Ej: Mínimo de tarjetas personales"
            />

            <Textarea
              label="Contenido"
              value={formContenido}
              onChange={(e) => setFormContenido(e.target.value)}
              rows={5}
              placeholder="Explicá la regla de forma clara y accionable..."
            />

            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={formCritica}
                  onChange={(e) => setFormCritica(e.target.checked)}
                />
                Regla crítica (puede exigir confirmación)
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Roles objetivo (opcional)</p>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      type="button"
                      key={role.value}
                      onClick={() => toggleRole(role.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        formRoles.includes(role.value)
                          ? 'border-blue-300 bg-blue-100 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleCreateRule}>
                <Save className="mr-2 h-4 w-4" />
                Guardar borrador
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="p-5 text-sm text-slate-600">Cargando reglas...</Card>
        ) : null}

        {error ? (
          <Card className="border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</Card>
        ) : null}

        {grouped.map((section) => (
          <Card key={section.id} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h4 className="font-semibold text-slate-900">{section.nombre}</h4>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={secciones.find((s) => s.id === section.id)?.is_active ?? true}
                  onChange={(e) => updateSeccion(section.id, { is_active: e.target.checked })}
                />
                Activa
              </label>
            </div>

            <div className="space-y-3">
              {section.reglas.length === 0 ? (
                <p className="text-sm text-slate-500">Sin reglas en esta sección.</p>
              ) : (
                section.reglas.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Input
                        defaultValue={item.titulo}
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          if (value && value !== item.titulo) {
                            void updateRegla(item.id, { titulo: value });
                          }
                        }}
                        className="max-w-md"
                      />
                      <Badge variant={item.estado === 'publicada' ? 'success' : 'warning'} size="sm">
                        {item.estado}
                      </Badge>
                      {item.es_critica ? <Badge variant="danger" size="sm">Crítica</Badge> : null}
                    </div>

                    <Textarea
                      defaultValue={item.contenido}
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        if (value && value !== item.contenido) {
                          void updateRegla(item.id, { contenido: value });
                        }
                      }}
                      rows={4}
                    />

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => updateRegla(item.id, { es_critica: !item.es_critica })}>
                        {item.es_critica ? 'Quitar crítica' : 'Marcar crítica'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => updateRegla(item.id, { is_active: !item.is_active })}>
                        {item.is_active ? 'Archivar' : 'Reactivar'}
                      </Button>
                      <Button size="sm" onClick={() => publishRegla(item.id)}>
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Publicar
                      </Button>
                      <span className="text-xs text-slate-500">Versión publicada: {item.version_publicada}</span>
                    </div>

                    {item.estado === 'publicada' ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Confirmaciones de lectura (v{item.version_publicada})
                          </p>
                          <Badge variant="info" size="sm">
                            {(acksByRuleVersion.get(`${item.id}:${item.version_publicada}`) || []).length} confirmaciones
                          </Badge>
                        </div>

                        {(acksByRuleVersion.get(`${item.id}:${item.version_publicada}`) || []).length === 0 ? (
                          <p className="text-xs text-slate-500">Todavía no hay confirmaciones para esta versión.</p>
                        ) : (
                          <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                            {(acksByRuleVersion.get(`${item.id}:${item.version_publicada}`) || []).map((ack) => (
                              <div key={ack.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">{ack.usuario_nombre}</p>
                                  <p className="text-xs text-slate-500">{ack.usuario_email} · {ack.usuario_role}</p>
                                </div>
                                <p className="text-xs text-slate-500">{formatDateTimeDisplay(ack.ack_at)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </Card>
        ))}
      </div>
    </DocumentationLayout>
  );
}

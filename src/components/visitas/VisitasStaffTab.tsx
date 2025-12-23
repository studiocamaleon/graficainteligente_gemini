import { useState, useEffect } from 'react';
import { useVisitasStaff, StaffMember } from '../../hooks/useVisitasStaff';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Modal } from '../ui/Modal';
import { Plus, Trash2, Edit2, Phone, User, Shield } from 'lucide-react';

export function VisitasStaffTab() {
    const { loadStaff, createStaff, updateStaff, deleteStaff, loading } = useVisitasStaff();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<StaffMember | null>(null);

    // Form State
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [rol, setRol] = useState('medidor');

    const fetchData = async () => {
        const data = await loadStaff();
        setStaff(data);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModal = (member?: StaffMember) => {
        if (member) {
            setEditingMember(member);
            setNombre(member.nombre);
            setTelefono(member.telefono);
            setRol(member.rol);
        } else {
            setEditingMember(null);
            setNombre('');
            setTelefono('');
            setRol('medidor');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let cleanedPhone = telefono.replace(/[^0-9]/g, '');
        // Basic format check
        if (cleanedPhone.length >= 10 && !cleanedPhone.startsWith('549')) {
            // Try to be smart? Or just suggest user?
            // If user puts 2966..., add 549
            if (cleanedPhone.length === 10) cleanedPhone = '549' + cleanedPhone;
        }

        try {
            if (editingMember) {
                await updateStaff(editingMember.id, { nombre, telefono: cleanedPhone, rol });
            } else {
                await createStaff({ nombre, telefono: cleanedPhone, rol, activo: true });
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            alert('Error al guardar miembro');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar este miembro? Dejará de recibir notificaciones.')) return;
        await deleteStaff(id);
        fetchData();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Equipo Comercial</h3>
                    <p className="text-sm text-slate-500">Administra quiénes recibirán notificaciones de nuevas visitas.</p>
                </div>
                <Button onClick={() => openModal()} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Nuevo Miembro
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staff.map(member => (
                    <div key={member.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 group hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                                    {member.nombre.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-900">{member.nombre}</h4>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full w-fit mt-1">
                                        <Shield className="w-3 h-3" /> <span className="capitalize">{member.rol}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="sm" onClick={() => openModal(member)}>
                                    <Edit2 className="w-4 h-4 text-slate-400 hover:text-blue-600" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(member.id)}>
                                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-600" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-2 pt-3 border-t border-slate-50 space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <Phone className="w-4 h-4 text-green-600" />
                                <span className="font-mono">{member.telefono}</span>
                            </div>
                        </div>

                        {!member.activo && (
                            <div className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded text-center font-medium">
                                Inactivo - No recibe alertas
                            </div>
                        )}
                    </div>
                ))}

                {staff.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        No hay miembros cargados en el equipo.
                    </div>
                )}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingMember ? "Editar Miembro" : "Agregar Miembro al Equipo"}
                size="md"
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nombre Completo</Label>
                        <Input
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                            placeholder="Ej: Juan Pérez"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Teléfono (WhatsApp)</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-green-600" />
                            <Input
                                value={telefono}
                                onChange={e => setTelefono(e.target.value)}
                                placeholder="Ej: 5492966..."
                                className="pl-9 font-mono"
                                required
                            />
                        </div>
                        <p className="text-xs text-slate-500">Ingresa el número completo con código de país (ej: 549 para Argentina), sin +.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Rol</Label>
                        <select
                            value={rol}
                            onChange={e => setRol(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="medidor">Medidor / Técnico</option>
                            <option value="vendedor">Vendedor</option>
                            <option value="admin">Administrativo</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" isLoading={loading}>Guardar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

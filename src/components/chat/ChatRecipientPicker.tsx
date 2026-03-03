import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Input } from '../ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useTeamMembers } from '../../hooks/useTeamMembers';
import type { Profile } from '../../types/database';

interface ChatRecipientPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (member: Profile) => Promise<void> | void;
  isProfileOnline?: (profileId?: string | null) => boolean;
}

export function ChatRecipientPicker({ isOpen, onClose, onSelect, isProfileOnline }: ChatRecipientPickerProps) {
  const { profile } = useAuth();
  const { members, loading } = useTeamMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        if (member.id === profile?.id) return false;
        if (!member.is_active) return false;

        const haystack = `${member.full_name} ${member.email}`.toLowerCase();
        return haystack.includes(searchTerm.trim().toLowerCase());
      }),
    [members, profile?.id, searchTerm]
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuevo chat directo" size="md">
      <div className="space-y-4">
        <div className="relative">
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por nombre o email"
            className="pl-11"
          />
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Cargando usuarios...
            </div>
          )}

          {!loading && filteredMembers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              <Users className="mx-auto mb-3 h-6 w-6 text-slate-300" />
              No se encontraron usuarios disponibles.
            </div>
          )}

          {filteredMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={async () => {
                try {
                  setSubmittingId(member.id);
                  await onSelect(member);
                } finally {
                  setSubmittingId(null);
                }
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Avatar
                size="md"
                src={member.avatar_url}
                name={member.full_name || member.email}
                showPresence
                isOnline={isProfileOnline?.(member.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{member.full_name}</p>
                <p className="truncate text-xs text-slate-500">{member.email}</p>
              </div>
              <span
                className={`inline-flex rounded-xl px-3 py-2 text-sm font-medium ${
                  submittingId === member.id ? 'text-slate-400' : 'text-sky-600'
                }`}
              >
                {submittingId === member.id ? 'Abriendo...' : 'Escribir'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function BILoadingState({ label = 'Cargando BI v2...' }: { label?: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-slate-200 bg-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-600" />
        <p className="mt-3 text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}

export function BIErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {message}
    </div>
  );
}

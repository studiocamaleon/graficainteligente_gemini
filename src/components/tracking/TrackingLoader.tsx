import { Loader2 } from 'lucide-react';

export function TrackingLoader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E27] via-[#1A1F3A] to-[#0A0E27] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-2xl animate-pulse" />
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin relative z-10" />
        </div>
        <p className="mt-6 text-lg text-cyan-100 font-medium animate-pulse">
          Cargando estado de tu orden...
        </p>
      </div>
    </div>
  );
}

import { Heart } from 'lucide-react';

export function TrackingFooter() {
  return (
    <footer className="mt-12 pb-8 text-center">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-[#1A1F3A] border border-cyan-500/10 rounded-xl p-6">
          <p className="text-gray-400 text-sm mb-4">
            ¿Tienes alguna pregunta sobre tu orden?
            <br />
            No dudes en contactarnos
          </p>

          <div className="flex items-center justify-center space-x-2 text-gray-500 text-xs">
            <span>Hecho con</span>
            <Heart className="w-4 h-4 text-red-400 fill-current animate-pulse" />
            <span>por tu equipo de producción</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

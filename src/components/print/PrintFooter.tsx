import { BRAND } from '../../constants/branding';

export function PrintFooter() {
  return (
    <div className="mt-12 pt-6 border-t border-gray-300 text-center page-break-inside-avoid">
      <p className="text-xs text-gray-600">
        © {new Date().getFullYear()} {BRAND.name}. Todos los derechos reservados.
      </p>
      <p className="text-xs text-gray-500 mt-1">
        Este documento ha sido generado automáticamente.
      </p>
    </div>
  );
}

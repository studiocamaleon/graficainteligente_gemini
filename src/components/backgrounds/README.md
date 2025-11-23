# ColorBends Background Component

Fondo animado dinámico con gradientes fluidos inspirado en React Bits.

## Uso Básico

```tsx
import { ColorBends } from './backgrounds/ColorBends';

function MyComponent() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <ColorBends />
      <div className="relative z-10">
        {/* Tu contenido aquí */}
      </div>
    </section>
  );
}
```

## Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `colors` | `string[]` | Ver abajo | Array de clases de gradiente Tailwind |
| `className` | `string` | `''` | Clases CSS adicionales |
| `speed` | `number` | `20` | Velocidad de animación en segundos |
| `opacity` | `number` | `0.6` | Opacidad de los elementos animados (0-1) |

### Colores por defecto:
```tsx
[
  'from-blue-400/30 via-cyan-400/30 to-blue-500/30',
  'from-cyan-400/30 via-blue-500/30 to-cyan-500/30',
  'from-blue-500/30 via-cyan-500/30 to-blue-400/30',
]
```

## Ejemplos

### Variante Rápida
```tsx
<ColorBends speed={15} opacity={0.7} />
```

### Variante Sutil
```tsx
<ColorBends speed={30} opacity={0.3} />
```

### Colores Personalizados - Púrpura/Rosa
```tsx
<ColorBends
  colors={[
    'from-purple-400/30 via-pink-400/30 to-purple-500/30',
    'from-pink-400/30 via-purple-500/30 to-pink-500/30',
    'from-purple-500/30 via-pink-500/30 to-purple-400/30',
  ]}
/>
```

### Colores Personalizados - Verde/Esmeralda
```tsx
<ColorBends
  colors={[
    'from-green-400/30 via-emerald-400/30 to-green-500/30',
    'from-emerald-400/30 via-green-500/30 to-emerald-500/30',
    'from-green-500/30 via-emerald-500/30 to-green-400/30',
  ]}
/>
```

### Con Overlay Oscuro para Texto Claro
```tsx
<section className="relative min-h-screen overflow-hidden">
  <ColorBends speed={25} opacity={0.8} />
  <div className="absolute inset-0 bg-black/40" />
  <div className="relative z-10 text-white">
    {/* Contenido con texto claro */}
  </div>
</section>
```

## Características

✅ **Animaciones Fluidas:** Múltiples capas con diferentes velocidades crean movimiento orgánico
✅ **GPU Accelerated:** Usa transform y filter para máxima performance
✅ **Accesibilidad:** Respeta `prefers-reduced-motion`
✅ **Responsive:** Funciona perfectamente en todos los tamaños de pantalla
✅ **Personalizable:** Colores, velocidad y opacidad totalmente configurables
✅ **Legibilidad:** Incluye overlay para asegurar contraste del texto

## Capas Incluidas

1. **Gradiente Base Estático** - Fondo suave sin animación
2. **Gradient Orbs (x3)** - Círculos grandes con gradientes que rotan y escalan
3. **Animated Waves** - Ondas radiales que se mueven en diagonal
4. **Subtle Grid** - Textura de grid muy sutil
5. **Light Rays** - Rayos verticales con opacidad pulsante
6. **Readability Overlay** - Gradiente final para mejorar contraste

## Performance

- **Bundle Impact:** ~5 KB adicionales
- **Dependencies:** Usa Framer Motion (ya incluido en el proyecto)
- **GPU Usage:** Optimizado para aceleración por hardware
- **CPU Impact:** Mínimo, desactivable con `prefers-reduced-motion`

## Accesibilidad

El componente detecta automáticamente la preferencia del usuario:

```tsx
// Detecta prefers-reduced-motion del sistema
const prefersReducedMotion = useReducedMotion();

// Si está activado, muestra versión estática
// Si no, muestra versión animada completa
```

## Tips de Uso

### Para secciones principales (Hero, etc.)
```tsx
<ColorBends speed={25} opacity={0.5} />
```

### Para secciones secundarias (Features, etc.)
```tsx
<ColorBends speed={30} opacity={0.3} className="opacity-60" />
```

### Para fondos sutiles (Footer, etc.)
```tsx
<ColorBends speed={40} opacity={0.2} className="opacity-40" />
```

## Solución de Problemas

### El texto no se lee bien
- Aumenta la opacidad del fondo: `bg-white/80` → `bg-white/90`
- Agrega drop-shadow al texto: `drop-shadow-sm`
- Usa colores más oscuros: `text-gray-600` → `text-gray-800`

### Las animaciones son muy lentas
- Reduce el valor de `speed`: `speed={15}`
- Recuerda que valores más bajos = más rápido

### Las animaciones son muy intensas
- Reduce `opacity`: `opacity={0.3}`
- Agrega `className="opacity-50"` al componente

### Quiero desactivar animaciones
```tsx
<ColorBends speed={0} opacity={0.4} />
// O mejor, usa un fondo estático directo
```

## Ejemplos de Integración

### Con Hero Section
```tsx
<section className="relative min-h-screen flex items-center overflow-hidden">
  <ColorBends speed={25} opacity={0.5} />
  <div className="relative max-w-7xl mx-auto px-4">
    <h1 className="text-6xl font-bold text-gray-900 drop-shadow-sm">
      Tu Título Aquí
    </h1>
  </div>
</section>
```

### Con Card Glassmorphism
```tsx
<section className="relative py-20 overflow-hidden">
  <ColorBends speed={30} opacity={0.4} />
  <div className="relative max-w-4xl mx-auto px-4">
    <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
      {/* Contenido de la tarjeta */}
    </div>
  </div>
</section>
```

### Con Dark Mode
```tsx
<section className="relative min-h-screen overflow-hidden bg-gray-900">
  <ColorBends
    opacity={0.3}
    colors={[
      'from-blue-600/20 via-cyan-600/20 to-blue-700/20',
      'from-cyan-600/20 via-blue-700/20 to-cyan-700/20',
      'from-blue-700/20 via-cyan-700/20 to-blue-600/20',
    ]}
  />
  <div className="relative text-white">
    {/* Contenido */}
  </div>
</section>
```

## Notas Técnicas

- Posición absoluta: El componente usa `absolute inset-0`
- Z-index: Por defecto no tiene z-index, estará detrás del contenido
- Overflow: El contenedor padre debe tener `overflow-hidden`
- Performance: Usa `will-change` implícito de Framer Motion

## License

Parte del proyecto principal. Libre de usar y modificar.

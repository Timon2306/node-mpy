/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        teal: {
          brand: '#0D9488',
          hover: '#14B8A6',
          muted: '#0F766E',
        },
        slate: {
          canvas: '#181B20',
          grid: '#242831',
          panel: '#21252D',
          panelHeader: '#282D37',
          card: '#242832',
          hover: '#2C323D',
          border: '#374151',
          subtle: '#4B5563',
          topbar: '#14171C',
        },
        port: {
          flow: '#FFFFFF',
          pin: '#10B981',
          bus: '#8B5CF6',
          device: '#F59E0B',
          number: '#3B82F6',
          boolean: '#EC4899',
          string: '#EAB308',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

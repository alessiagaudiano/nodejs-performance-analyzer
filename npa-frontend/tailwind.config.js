// tailwind.config.js (Da mettere nella cartella radice del progetto)
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Mappatura definitiva dei colori alla tua palette
      colors: {
        'bg-primary': '#17223a',    // Sfondo principale Deep Blue
        'bg-card': '#1e2a44',       // Sfondo per Card e Sidebar
        'bg-card-hover': '#293347',
        'accent': '#fa681fff',       // Colore di Accento (Arancio)
        'text-main': '#E5E7EB',     // Testo principale (Bianco)
        'text-dim': '#9CA3AF',      // Testo Diminuito
        'btn-confirm': '#335747',
        'btn-confirm-hover': '#485c53',
      },
      // Qui puoi mappare altre proprietà se necessario
    },
  },
  plugins: [],
}
/** @type {import('tailwindcss').Config} */

export default {
  
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primario: 'var(--color-primario)',
        'primario-dark': 'var(--color-primario-dark)',
        'primario-suave': 'var(--color-primario-suave)',
      },
      fontFamily: {
        app: 'var(--fuente-app)',
      },
    },
  },
  plugins: [],
}

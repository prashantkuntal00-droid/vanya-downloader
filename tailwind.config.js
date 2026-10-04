/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36aff8',
          500: '#0c93e7',
          600: '#0275c5',
          700: '#035da2',
          800: '#074f85',
          900: '#0c426e',
          950: '#082a49',
        },
        dark: {
          bg: '#0f172a',
          card: '#1e293b',
          border: '#334155',
          hover: '#334155',
          text: '#f8fafc',
          muted: '#94a3b8',
        }
      },
    },
  },
  plugins: [],
}

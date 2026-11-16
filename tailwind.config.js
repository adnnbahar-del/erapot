/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#081a57',
          900: '#081a57',
          800: '#0b1f6b',
          700: '#13308f',
          500: '#3552c4',
        },
        paper: {
          DEFAULT: '#ffffff',
          2: '#f6f8fc',
        },
        line: {
          DEFAULT: '#dfe5f2',
          2: '#c9d2e8',
        },
        ink: '#141c38',
        muted: '#5f6a8a',
        soft: '#6b7593',
        guru: {
          DEFAULT: '#0f9d58',
          700: '#0b8549',
          tint: '#f2fbf6',
          edge: '#cdeedb',
        },
        admin: {
          DEFAULT: '#0d2370',
          700: '#091a55',
        },
        amber: {
          DEFAULT: '#f2a33a',
          tint: '#fff6ea',
          edge: '#f6dcb4',
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          500: '#f2a33a',
          600: '#d97706',
          700: '#b45309',
        },
        rose: {
          DEFAULT: '#d64545',
          tint: '#fdeeee',
          ink: '#a62e2e',
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          500: '#d64545',
          600: '#e11d48',
          700: '#be123c',
        },
        // Backwards compatibility colors
        'navy-900': '#081a57',
        'navy-800': '#0b1f6b',
        'navy-500': '#3552c4',
        'paper-2': '#f6f8fc',
        kemdikbud: {
          dark: '#0b1f6b',
          sidebar: '#0d2370',
          hover: '#123092',
          accent: '#f28a2e',
          success: '#0f9d58',
          bg: '#f2f5fb',
        },
        koku: {
          no: '#00b0f0',
          kuat: '#a9d18e',
          penguatan: '#ffe699',
          tema: '#9dc3e6',
          deskripsi: '#fbe5d6',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        field: '12px',
        card: '20px',
      },
      boxShadow: {
        card: '0 20px 50px rgba(15,28,80,0.12)',
        sheet: '0 24px 50px rgba(2,8,35,0.55)',
        tab: '0 2px 8px rgba(20,28,56,0.12)',
        'btn-guru': '0 10px 22px rgba(15,157,88,0.28)',
        'btn-admin': '0 10px 22px rgba(13,35,112,0.30)',
        focus: '0 0 0 4px rgba(53,82,196,0.14)',
        'focus-bad': '0 0 0 4px rgba(214,69,69,0.12)',
      },
      keyframes: {
        'float-sheet': {
          '0%, 100%': { transform: 'rotate(-2.5deg) translateY(0)' },
          '50%': { transform: 'rotate(-2.5deg) translateY(-6px)' },
        },
        'card-rise': {
          '0%': { transform: 'translateY(12px)' },
          '100%': { transform: 'translateY(0)' },
        },
        'card-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'float-sheet': 'float-sheet 7s ease-in-out infinite',
        'card-rise': 'card-rise 500ms cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'card-shake': 'card-shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
      },
    },
  },
  plugins: [],
}

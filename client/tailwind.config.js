/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f6',
          100: '#f9ede7',
          200: '#f3d9ce',
          300: '#e9bba6',
          400: '#dd9675',
          500: '#d17850',
          600: '#c06440',
          700: '#a05136',
          800: '#834531',
          900: '#6b3b2c',
        },
      },
    },
  },
  plugins: [],
};

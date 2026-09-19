/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f5f1',
        card: '#ffffff',
        ink: {
          900: '#1a2330',
          700: '#3d4a5c',
          500: '#6b7789',
          300: '#c5ccd6',
          100: '#ece8e1',
        },
        teal: {
          900: '#0b3d3d',
          800: '#0f5c5c',
          600: '#1a7a74',
          100: '#e4f2f0',
        },
        gold: {
          600: '#b0893a',
          100: '#f6eedc',
        },
        rose: {
          700: '#9b2c2c',
          100: '#fdecec',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        ams: '0 1px 2px rgba(26, 35, 48, 0.06), 0 8px 24px rgba(26, 35, 48, 0.04)',
      },
    },
  },
  plugins: [],
};

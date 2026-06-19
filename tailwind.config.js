/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        f1: {
          bg: '#07080b',
          card: '#11131a',
          line: '#272b36',
          red: '#ff1e35',
          orange: '#ff7a18'
        }
      }
    }
  },
  plugins: []
};

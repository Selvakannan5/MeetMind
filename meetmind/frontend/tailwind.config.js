/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0a0c10',
        surface:  '#111318',
        surface2: '#181c24',
        border:   'rgba(255,255,255,0.07)',
        border2:  'rgba(255,255,255,0.12)',
        accent:   '#6c63ff',
        accent2:  '#00d4aa',
        s1: '#818cf8',
        s2: '#34d399',
        s3: '#fb923c',
        s4: '#f472b6',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

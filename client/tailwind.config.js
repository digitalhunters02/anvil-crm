/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        head: ['"Oswald"', '"Arial Narrow"', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        bg: '#eeeeeb',
        surface: '#ffffff',
        ink: '#1b1c1e',
        muted: '#5b5e62',
        faint: '#93969a',
        line: '#dcdbd6',
        lineSoft: '#e8e7e2',
        wash: '#e4e3dd',

        side: '#17181a',
        side2: '#232427',
        sideLine: '#34363a',
        sideText: '#c9cacc',
        sideMuted: '#83868a',

        brand: '#b3261e',
        brandTint: '#f5dcd8',
        amber: '#8a6a1a',
        amberTint: '#f3e7c9',
        rose: '#93264c',
        roseTint: '#f5dbe4',
        blue: '#1d5c8a',
        blueTint: '#dbe8f2',
        violet: '#6a4a8a',
        violetTint: '#e9def0',
        green: '#2f6b3a',
        greenTint: '#dcefdf',
        steel: '#43494f',
        steelTint: '#e4e6e8',
      },
    },
  },
  plugins: [],
};

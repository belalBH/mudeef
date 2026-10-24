/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#F4F6F5',
        ink: '#17201C',
        muted: '#5E6B65',
        line: '#DCE2DF',
        palm: { DEFAULT: '#1F5C45', dark: '#174634', soft: '#E3EEE8' },
        saffron: { DEFAULT: '#C8902E', soft: '#F7ECD8' },
        danger: { DEFAULT: '#B4382F', soft: '#F8E4E2' },
        src: {
          direct: '#1F5C45',
          airbnb: '#D9555B',
          booking: '#2A5BA8',
          gathern: '#6B4BB4',
          other: '#7A7F7C',
        },
      },
    },
  },
  plugins: [],
};

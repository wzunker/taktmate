/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Takt Brand Typography
      fontFamily: {
        'poppins': ['Poppins', 'system-ui', 'sans-serif'],
        'sans': ['Poppins', 'system-ui', 'sans-serif'], // Override default sans
      },
      // Typography Scale
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      // Font Weights
      fontWeight: {
        'normal': '400',    // Poppins Regular
        'medium': '500',    // Poppins Medium  
        'semibold': '600',  // Poppins Semibold
        'bold': '700',      // Poppins Bold
      },
      colors: {
        // Takt Brand Colors
        takt: {
          orange: '#E16809',      // Primary: Takt Orange
          green: '#3E553C',       // Secondary: Takt Green
          'iron-grey': '#322E2D', // Text: Iron Grey
          'canvas-cream': '#F7F3E9', // Background: Canvas Cream
          'amber-orange': '#CC7A00',  // Accent: Amber Orange
          'solar-orange': '#FFA51F',  // Accent: Solar Orange
          'sky-blue': '#4B95D1',      // Accent: Sky Blue
        },
        // Primary color mapping to Takt Orange for backward compatibility
        primary: {
          50: '#fef7ed',   // Very light orange
          100: '#fdedd3',  // Light orange
          200: '#fbd7a5',  // Lighter orange
          300: '#f8b86d',  // Light orange
          400: '#f59332',  // Medium orange
          500: '#E16809',  // Takt Orange (main)
          600: '#cc5d08',  // Darker orange
          700: '#a84a07',  // Dark orange
          800: '#8a3c0a',  // Very dark orange
          900: '#72340c',  // Darkest orange
        },
        // Secondary color mapping to Takt Green
        secondary: {
          50: '#f6f8f6',   // Very light green
          100: '#e9f0e8',  // Light green
          200: '#d4e2d2',  // Lighter green
          300: '#b3cab0',  // Light green
          400: '#8aab85',  // Medium green
          500: '#3E553C',  // Takt Green (main)
          600: '#374d34',  // Darker green
          700: '#2f402d',  // Dark green
          800: '#283426',  // Very dark green
          900: '#222c21',  // Darkest green
        },
        // Background and neutral colors
        background: {
          cream: '#F7F3E9',     // Canvas Cream
          'warm-white': '#FEFCF8', // Slightly warmer white
          'warm-gray': '#F5F2ED',  // Warm gray variant
        },
        // Text colors
        text: {
          primary: '#322E2D',    // Iron Grey
          secondary: '#5A5450',  // Lighter iron grey
          muted: '#8B8680',      // Muted text
        }
      }
    },
  },
  plugins: [],
}

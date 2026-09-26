/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Design System — Yellow × Navy Corporate SaaS Theme */
        brand: {
          navy: "#202C52",
          navyDark: "#050E2F",
          navySoft: "#2B385F",
          yellow: "#FCBD16",
          yellowHover: "#E9AA00",
          yellowSoft: "#FFF4CC",
        },
        surface: {
          DEFAULT: "#F5F5F5",
          white: "#FFFFFF",
          gray: "#F5F5F5",
          soft: "#FAFAFA",
          yellow: "#FFF4CC",
        },
        text: {
          primary: "#202C52",
          secondary: "#667085",
          muted: "#98A2B3",
          light: "#98A2B3",
          inverse: "#FFFFFF",
        },
        border: {
          DEFAULT: "#E8E8E8",
        },

        /* Primary token mapping */
        primary: {
          DEFAULT: '#202C52',
          dark: '#050E2F',
          soft: '#2B385F',
          pressed: '#050E2F',
          deep: '#050E2F',
        },
        'on-primary': '#ffffff',

        /* Accent token mapping */
        accent: {
          DEFAULT: '#FCBD16',
          hover: '#E9AA00',
          soft: '#FFF4CC',
        },

        /* Specific legacy compatibility aliases */
        'brand-navy': {
          DEFAULT: '#202C52',
          deep: '#050E2F',
          mid: '#2B385F',
        },
        'brand-yellow': {
          DEFAULT: '#FCBD16',
          hover: '#E9AA00',
          soft: '#FFF4CC',
        },
        'link-blue': '#2563EB',
        'brand-orange': '#FCBD16',
        'brand-pink': '#D92D20',
        'brand-purple': '#202C52',
        'brand-teal': '#16803C',
        'brand-green': '#16803C',

        /* Card Tints with Yellow / Slate harmony */
        'tint-peach': '#FFF4CC',
        'tint-rose': '#FEE4E2',
        'tint-mint': '#D1FADF',
        'tint-lavender': '#E0EAFF',
        'tint-sky': '#E0F2FE',
        'tint-yellow': '#FFF4CC',
        'tint-yellow-bold': '#FCBD16',
        'tint-cream': '#FAFAFA',
        'tint-gray': '#F5F5F5',

        /* Surface Colors */
        canvas: '#FFFFFF',
        hairline: {
          DEFAULT: '#E8E8E8',
          soft: '#F2F2F2',
          strong: '#D0D5DD',
        },

        /* Typography & Text */
        'ink-deep': '#202C52',
        ink: '#202C52',
        charcoal: '#202C52',
        slate: {
          DEFAULT: '#667085',
          light: '#98A2B3',
        },
        stone: '#98A2B3',
        muted: '#98A2B3',
        'on-dark': '#FFFFFF',
        'on-dark-muted': '#C7CEDD',

        /* Semantic */
        success: '#16803C',
        warning: '#FCBD16',
        error: '#D92D20',
        info: '#2563EB',

        /* Dynamic shell bindings */
        shell: "var(--color-primary)",
        "shell-text": "#FFFFFF",
        content: "var(--color-surface)",
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'sans-serif'],
        display: ['Poppins', 'Inter', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '10px',
        'lg': '14px',
        'xl': '18px',
        'pill': '999px',
        'full': '9999px',
      },
      boxShadow: {
        'card': '0 2px 12px rgba(32, 44, 82, 0.08)',
        'hover': '0 8px 24px rgba(32, 44, 82, 0.12)',
        'floating': '0 12px 32px rgba(32, 44, 82, 0.16)',
        'sm': '0 2px 12px rgba(32, 44, 82, 0.06)',
        'md': '0 8px 24px rgba(32, 44, 82, 0.10)',
        'lg': '0 12px 32px rgba(32, 44, 82, 0.16)',
        'level-1': '0 2px 8px rgba(32, 44, 82, 0.06)',
        'level-2': '0 4px 16px rgba(32, 44, 82, 0.08)',
        'level-3': '0 8px 24px rgba(32, 44, 82, 0.12)',
        'level-4': '0 16px 40px rgba(32, 44, 82, 0.16)',
      },
      spacing: {
        'xxs': '4px',
        'xs': '8px',
        'sm': '12px',
        'md': '16px',
        'lg': '20px',
        'xl': '24px',
        '2xl': '32px',
        '3xl': '40px',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '32': '128px',
      },
      transitionDuration: {
        'fast': '160ms',
        'base': '220ms',
        'slow': '600ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'float-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float-subtle 3s ease-in-out infinite',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
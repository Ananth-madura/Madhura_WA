module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* DESIGN.md - Notion Design System */
        primary: {
          DEFAULT: '#5645d4',
          pressed: '#4534b3',
          deep: '#3a2a99',
        },
        'on-primary': '#ffffff',
        'brand-navy': {
          DEFAULT: '#0a1530',
          deep: '#070f24',
          mid: '#1a2a52',
        },
        'link-blue': '#0075de',
        'brand-orange': '#dd5b00',
        'brand-pink': '#ff64c8',
        'brand-purple': '#7b3ff2',
        'brand-teal': '#2a9d99',
        'brand-green': '#1aae39',
        'brand-yellow': '#f5d75e',

        /* Card Tints */
        'tint-peach': '#ffe8d4',
        'tint-rose': '#fde0ec',
        'tint-mint': '#d9f3e1',
        'tint-lavender': '#e6e0f5',
        'tint-sky': '#dcecfa',
        'tint-yellow': '#fef7d6',
        'tint-yellow-bold': '#f9e79f',
        'tint-cream': '#f8f5e8',
        'tint-gray': '#f0eeec',

        /* Surface Colors */
        canvas: '#ffffff',
        surface: {
          DEFAULT: '#f6f5f4',
          soft: '#fafaf9',
        },
        hairline: {
          DEFAULT: '#e5e3df',
          soft: '#ede9e4',
          strong: '#c8c4be',
        },

        /* Text Colors */
        'ink-deep': '#000000',
        ink: '#1a1a1a',
        charcoal: '#37352f',
        slate: {
          DEFAULT: '#5d5b54',
          light: '#787671',
        },
        stone: '#a4a097',
        muted: '#bbb8b1',
        'on-dark': '#ffffff',
        'on-dark-muted': '#a4a097',

        /* Semantic */
        success: '#1aae39',
        warning: '#dd5b00',
        error: '#e03131',

        /* UIUX.md - Backup colors */
        shell: "var(--shell-bg)",
        "shell-text": "var(--shell-text)",
        content: "var(--content-bg)",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica', 'sans-serif'],
        display: ['Inter', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'DEFAULT': '8px',
        'md': '6px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
        'full': '9999px',
      },
      boxShadow: {
        'card': '0 1px 2px hsl(240 20% 6% / 0.04), 0 4px 16px hsl(240 20% 6% / 0.04)',
        'elevated': '0 4px 12px hsl(240 20% 6% / 0.06), 0 16px 40px hsl(199 100% 40% / 0.08)',
        'level-1': 'rgba(15, 15, 15, 0.04) 0px 1px 2px 0px',
        'level-2': 'rgba(15, 15, 15, 0.08) 0px 4px 12px 0px',
        'level-3': 'rgba(15, 15, 15, 0.20) 0px 24px 48px -8px',
        'level-4': 'rgba(15, 15, 15, 0.16) 0px 16px 48px -8px',
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
      },
      zIndex: {
        'dropdown': '10',
        'sticky': '20',
        'fixed': '30',
        'modal-backdrop': '40',
        'modal': '50',
        'popover': '60',
        'tooltip': '70',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', backdropFilter: 'blur(0px)' },
          '100%': { opacity: '1', backdropFilter: 'blur(4px)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'slide-in': 'slide-in 0.3s ease-out',
        'door-open': 'doorOpen 0.45s ease-out',
        'fade-in': 'fade-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
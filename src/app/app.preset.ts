import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#F0F3FF',
      100: '#E1E8FE',
      200: '#C3D1FE',
      300: '#9EB7FD',
      400: '#7AA1FD',
      500: '#4D8BFC',
      600: '#1676EE',
      700: '#1060C5',
      800: '#0B4EA2',
      900: '#03285A',
      950: '#01183C',
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.800}',
          hoverColor: '{primary.900}',
          activeColor: '{primary.950}',
          contrastColor: '#FFFFFF',
        },
        // Surface ramp aligned to Meedo's light tokens (src/styles.css) so PrimeNG
        // overlays, inputs, and menus match the custom UI instead of Aura's slate.
        // Aura references these indices: 0 = surface/overlay bg, 50 = filled field,
        // 100 = hover, 200 = content border (--border), 300 = field border
        // (--border-strong), 500 = muted text/placeholder (--text-muted),
        // 700 = body text (--text-body), 900 = heading.
        surface: {
          0: '#FFFFFF',
          50: '#F1F6FC',
          100: '#EEF3F9',
          200: '#DBE5F0',
          300: '#C7D6E6',
          400: '#9DB0C2',
          500: '#5E7180',
          600: '#4A5C6A',
          700: '#365261',
          800: '#24414F',
          900: '#0B161F',
          950: '#060D13',
        },
      },
      dark: {
        primary: {
          color: '{primary.400}',
          hoverColor: '{primary.300}',
          activeColor: '{primary.200}',
          contrastColor: '{primary.950}',
        },
        // Dark ramp mapped to Meedo's tuned surfaces (NOT Aura's zinc). Aura
        // references: 950 = field bg (--surface), 900 = overlay/dialog/menu bg
        // (--popover), 800 = hover/active fill, 700 = overlay border
        // (--border-strong), 400 = muted text/icons/placeholder (--text-muted),
        // 0 = heading text. Kept monotonic so every Aura role lands on the right tone.
        surface: {
          0: '#ECF1F8',
          50: '#D6DEE8',
          100: '#C2CDDA',
          200: '#AEBDCC',
          300: '#94A6B8',
          400: '#8A99A8',
          500: '#6E7E8D',
          600: '#38434F',
          700: '#2E3A48',
          800: '#232C38',
          900: '#1A212B',
          950: '#10151C',
        },
      },
    },
  },
});

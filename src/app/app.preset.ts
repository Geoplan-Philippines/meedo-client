import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/*
 * Component tokens reference the CSS variables in src/styles.css (var(--page),
 * var(--divider), ...). Those variables are redefined under `.app-dark`, so one
 * value here serves both colour schemes. Aura's own colorScheme entries are
 * overridden explicitly where Aura sets a per-scheme value.
 */
const listTable = {
  root: { borderColor: 'var(--divider)' },
  header: { background: 'transparent', borderColor: 'var(--divider)', color: 'var(--text-body)', padding: '0.5rem 0' },
  headerCell: {
    background: 'var(--page)',
    hoverBackground: 'var(--hover)',
    selectedBackground: 'var(--page)',
    borderColor: 'var(--divider)',
    color: 'var(--text-muted)',
    hoverColor: 'var(--text-heading)',
    // Sorted columns keep the muted header colour; the visible sort icon and aria-sort mark them.
    selectedColor: 'var(--text-muted)',
    gap: '0.375rem',
    padding: '0.5rem var(--cell-x)',
  },
  columnTitle: { fontWeight: '500' },
  row: {
    background: 'transparent',
    hoverBackground: 'var(--hover)',
    selectedBackground: 'var(--selected)',
    color: 'var(--text-body)',
    hoverColor: 'var(--text-heading)',
    selectedColor: 'var(--text-heading)',
  },
  bodyCell: { borderColor: 'var(--divider)', padding: '0.5rem var(--cell-x)' },
  footerCell: { background: 'transparent', borderColor: 'var(--divider)', color: 'var(--text-body)' },
  footer: { background: 'transparent', borderColor: 'var(--divider)', color: 'var(--text-body)' },
  sortIcon: { color: 'var(--text-faint)', hoverColor: 'var(--text-body)', size: '0.75rem' },
  paginatorTop: { borderColor: 'var(--divider)', borderWidth: '0 0 1px 0' },
  paginatorBottom: { borderColor: 'var(--divider)', borderWidth: '1px 0 0 0' },
  colorScheme: {
    light: { root: { borderColor: 'var(--divider)' }, row: { stripedBackground: 'var(--subtle)' }, bodyCell: { selectedBorderColor: 'var(--divider)' } },
    dark: { root: { borderColor: 'var(--divider)' }, row: { stripedBackground: 'var(--subtle)' }, bodyCell: { selectedBorderColor: 'var(--divider)' } },
  },
};

/* Badges and pills: muted fill + tuned foreground (AA on its fill in both themes). */
const badgeScheme = {
  primary: { background: 'var(--secondary)', color: 'var(--secondary-foreground)' },
  secondary: { background: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-fg)' },
  success: { background: 'var(--muted-success)', color: 'var(--muted-success-foreground)' },
  info: { background: 'var(--muted-info)', color: 'var(--muted-info-foreground)' },
  warn: { background: 'var(--muted-warning)', color: 'var(--muted-warning-foreground)' },
  danger: { background: 'var(--muted-destructive)', color: 'var(--muted-destructive-foreground)' },
  contrast: { background: 'var(--text-heading)', color: 'var(--page)' },
};

/* Segmented control (SelectButton is built on ToggleButton). */
const segmentScheme = {
  root: {
    background: 'var(--subtle)',
    checkedBackground: 'var(--subtle)',
    hoverBackground: 'var(--subtle)',
    borderColor: 'var(--subtle)',
    color: 'var(--text-muted)',
    hoverColor: 'var(--text-heading)',
    checkedColor: 'var(--text-heading)',
    checkedBorderColor: 'var(--subtle)',
  },
  content: { checkedBackground: 'var(--raised)' },
  icon: { color: 'var(--text-muted)', hoverColor: 'var(--text-heading)', checkedColor: 'var(--text-heading)' },
};

export const AppPreset = definePreset(Aura, {
  components: {
    datatable: listTable,
    paginator: {
      root: { padding: '0', gap: '0.25rem', borderRadius: '0', background: 'transparent', color: 'var(--text-body)' },
      navButton: {
        background: 'transparent',
        hoverBackground: 'var(--hover)',
        selectedBackground: 'var(--selected)',
        color: 'var(--text-muted)',
        hoverColor: 'var(--text-heading)',
        selectedColor: 'var(--text-heading)',
        width: '2rem',
        height: '2rem',
        borderRadius: 'var(--radius)',
      },
      currentPageReport: { color: 'var(--text-muted)' },
    },
    tabs: {
      tablist: { background: 'transparent', borderColor: 'var(--divider)', borderWidth: '0 0 1px 0' },
      tab: {
        background: 'transparent',
        hoverBackground: 'transparent',
        activeBackground: 'transparent',
        borderColor: 'transparent',
        hoverBorderColor: 'transparent',
        activeBorderColor: 'transparent',
        color: 'var(--text-muted)',
        hoverColor: 'var(--text-heading)',
        activeColor: 'var(--text-heading)',
        padding: '0.625rem 0.75rem',
        fontWeight: '500',
        gap: '0.375rem',
      },
      tabpanel: { background: 'transparent', color: 'inherit', padding: '0' },
      activeBar: { height: '2px', background: 'var(--primary)' },
    },
    tag: {
      root: {
        fontSize: '0.75rem',
        fontWeight: '500',
        padding: '0.125rem 0.5rem',
        gap: '0.25rem',
        borderRadius: 'var(--radius)',
        roundedBorderRadius: 'var(--pill-radius)',
      },
      icon: { size: '0.625rem' },
      colorScheme: { light: badgeScheme, dark: badgeScheme },
    },
    /* Page toolbar: a plain row on the page, no panel. */
    toolbar: {
      root: { background: 'transparent', borderColor: 'transparent', borderRadius: '0', color: 'inherit', gap: 'var(--toolbar-gap)', padding: '0.75rem 0' },
    },
    /* Count chips (tabs, filter button). */
    badge: {
      root: { borderRadius: 'var(--pill-radius)', padding: '0 0.3125rem', fontSize: '0.6875rem', fontWeight: '600', minWidth: '1.25rem', height: '1.125rem' },
      colorScheme: {
        light: { secondary: { background: 'var(--subtle)', color: 'var(--text-muted)' }, primary: { background: 'var(--selected)', color: 'var(--text-heading)' } },
        dark: { secondary: { background: 'var(--subtle)', color: 'var(--text-muted)' }, primary: { background: 'var(--selected)', color: 'var(--text-heading)' } },
      },
    },
    /* Inline banners: muted status fills, AA text. */
    message: {
      colorScheme: {
        light: {
          info: { background: 'var(--muted-info)', borderColor: 'transparent', color: 'var(--muted-info-foreground)', shadow: 'none' },
          error: { background: 'var(--muted-destructive)', borderColor: 'transparent', color: 'var(--muted-destructive-foreground)', shadow: 'none' },
          warn: { background: 'var(--muted-warning)', borderColor: 'transparent', color: 'var(--muted-warning-foreground)', shadow: 'none' },
        },
        dark: {
          info: { background: 'var(--muted-info)', borderColor: 'transparent', color: 'var(--muted-info-foreground)', shadow: 'none' },
          error: { background: 'var(--muted-destructive)', borderColor: 'transparent', color: 'var(--muted-destructive-foreground)', shadow: 'none' },
          warn: { background: 'var(--muted-warning)', borderColor: 'transparent', color: 'var(--muted-warning-foreground)', shadow: 'none' },
        },
      },
    },
    /* Outlined and text danger buttons use the AA status text token (Aura's red.500 is 3.8:1 on white). */
    button: {
      colorScheme: {
        light: {
          outlined: { danger: { color: 'var(--muted-destructive-foreground)', borderColor: 'color-mix(in srgb, var(--destructive) 45%, transparent)' } },
          text: { danger: { color: 'var(--muted-destructive-foreground)' } },
        },
        dark: {
          outlined: { danger: { color: 'var(--muted-destructive-foreground)', borderColor: 'color-mix(in srgb, var(--destructive) 45%, transparent)' } },
          text: { danger: { color: 'var(--muted-destructive-foreground)' } },
        },
      },
    },
    togglebutton: {
      root: { padding: '0.1875rem', gap: '0.375rem', fontWeight: '500' },
      content: { padding: '0.25rem 0.625rem', borderRadius: 'var(--radius)', checkedShadow: '0 1px 2px 0 rgb(0 0 0 / 0.06)' },
      colorScheme: { light: segmentScheme, dark: segmentScheme },
    },
  },
  semantic: {
    focusRing: { width: '2px', style: 'solid', color: 'var(--ring)', offset: '2px', shadow: 'none' },
    formField: {
      paddingX: '0.75rem',
      paddingY: '0.4375rem',
      sm: { fontSize: '0.875rem', paddingX: '0.625rem', paddingY: '0.3125rem' },
      lg: { fontSize: '1.125rem', paddingX: '0.875rem', paddingY: '0.625rem' },
      borderRadius: '{border.radius.sm}',
      focusRing: { width: '0', style: 'none', color: 'transparent', offset: '0', shadow: 'none' },
      transitionDuration: '{transition.duration}',
    },
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

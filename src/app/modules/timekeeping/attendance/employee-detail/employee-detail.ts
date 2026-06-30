import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DOCUMENT, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { auditTime, finalize } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import {
  LngLatBounds,
  Map as MaplibreMap,
  Marker,
  NavigationControl,
  Popup,
} from 'maplibre-gl';

import { AttendanceService } from '../services/attendance.service';
import { ThemeService } from '../../../../core/theme/theme.service';
import {
  AttendanceEvent,
  AttendanceEventType,
  DailyAttendanceSummary,
} from '../models/attendance.model';

/**
 * Marker colors by punch context (field=blue, wfh=yellow, manual office=green,
 * biometric=purple). Values reference the theme tokens in `styles.css` so the
 * hex lives in one place; markers set these as the `--dot` custom property and
 * CSS resolves them.
 */
const SOURCE_COLORS = {
  FIELD: 'var(--color-attendance-field)',
  WFH: 'var(--color-attendance-wfh)',
  OFFICE_MANUAL: 'var(--color-attendance-office)',
  BIOMETRIC: 'var(--color-attendance-biometric)',
} as const;

/**
 * Free CARTO vector basemaps (no API key) — street-level roads, water, and city
 * labels with self-hosted glyphs/sprites. Positron for light mode, Dark Matter
 * for dark mode, swapped live to follow the app theme.
 */
const LIGHT_STYLE_URL = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** A single punch: the event to plot and the text shown on its pill. */
interface MarkerSpec {
  event: AttendanceEvent;
  label: string;
}

/** Punches of one work-type at one location, collapsed into a single colored pill. */
interface MarkerGroup {
  lngLat: [number, number];
  items: MarkerSpec[];
  color: string;
  label: string;
  /** Pixel offset so multiple work-types at the same spot fan out instead of stacking. */
  offset: [number, number];
}

/** Coordinate precision for grouping (3 decimals ≈ 110 m — covers GPS drift at one site). */
const GROUP_PRECISION = 3;
/** Horizontal spacing between fanned-out pills sharing a location. */
const FAN_SPACING = 46;

@Component({
  selector: 'app-attendance-employee-detail',
  imports: [ButtonModule, TagModule, DatePipe],
  templateUrl: './employee-detail.html',
  styleUrl: './employee-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeDetail implements OnInit, AfterViewInit {
  private readonly attendanceService = inject(AttendanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);

  private employeeId = '';
  private selectedDate: string | undefined;

  private readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map: MaplibreMap | null = null;
  private markers: { marker: Marker; popup: Popup; base: [number, number] }[] = [];
  private readonly mapReady = signal(false);

  private currentStyleUrl = '';

  // Selected day timeline.
  readonly summary = signal<DailyAttendanceSummary | null>(null);
  readonly isLoading = signal(false);

  readonly firstIn = computed(() => this.summary()?.firstIn ?? null);
  readonly lastOut = computed(() => this.summary()?.lastOut ?? null);
  readonly billableHours = computed(() => this.summary()?.billableHours ?? null);
  readonly events = computed<AttendanceEvent[]>(() => this.summary()?.events ?? []);

  readonly locatedEvents = computed(() =>
    this.events().filter((e) => e.latitude !== null && e.longitude !== null),
  );

  /**
   * Markers to plot. Manual punches each get a pin, but biometric door taps can
   * be many in a day — so for biometrics we keep only the first-in and last-out.
   */
  readonly markerEvents = computed<MarkerSpec[]>(() => {
    const located = this.locatedEvents();

    const manual: MarkerSpec[] = located
      .filter((e) => e.origin !== 'BIOMETRICS')
      .map((event) => ({ event, label: this.eventTypeLabel(event.eventType) }));

    const biometric = located
      .filter((e) => e.origin === 'BIOMETRICS')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const biometricSpecs: MarkerSpec[] =
      biometric.length === 0
        ? []
        : biometric.length === 1
          ? [{ event: biometric[0], label: 'Biometric' }]
          : [
              { event: biometric[0], label: 'First In' },
              { event: biometric[biometric.length - 1], label: 'Last Out' },
            ];

    return [...manual, ...biometricSpecs].sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime(),
    );
  });

  /**
   * Group punches by location AND work-type, so each work-type gets its own
   * colored pill. WFH in/out at one spot collapse into one yellow pill; a field
   * in/out at the same spot becomes a separate blue pill. When several work-types
   * share a location their pills fan out horizontally instead of stacking, so the
   * user can read WFH vs Field vs Office at a glance.
   */
  readonly markerGroups = computed<MarkerGroup[]>(() => {
    const locKey = (e: AttendanceEvent) =>
      `${e.latitude!.toFixed(GROUP_PRECISION)},${e.longitude!.toFixed(GROUP_PRECISION)}`;

    // Bucket by location + color (work-type), preserving insertion order.
    const buckets = new Map<string, MarkerSpec[]>();
    for (const spec of this.markerEvents()) {
      const key = `${locKey(spec.event)}|${this.markerColor(spec.event)}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(spec);
      buckets.set(key, bucket);
    }

    // Count how many distinct work-type pills share each location, to fan them out.
    const perLocationCount = new Map<string, number>();
    const groupLocations = Array.from(buckets.keys()).map((key) => key.split('|')[0]);
    for (const loc of groupLocations) {
      perLocationCount.set(loc, (perLocationCount.get(loc) ?? 0) + 1);
    }

    const perLocationIndex = new Map<string, number>();
    return Array.from(buckets.entries()).map(([key, items]) => {
      const loc = key.split('|')[0];
      const total = perLocationCount.get(loc)!;
      const index = perLocationIndex.get(loc) ?? 0;
      perLocationIndex.set(loc, index + 1);

      const anchor = items[0].event;
      return {
        lngLat: [anchor.longitude!, anchor.latitude!] as [number, number],
        items,
        color: this.markerColor(anchor),
        label: this.workTypeLabel(anchor),
        offset: [(index - (total - 1) / 2) * FAN_SPACING, 0] as [number, number],
      };
    });
  });

  readonly hasLocatedEvents = computed(() => this.markerEvents().length > 0);

  constructor() {
    // Re-render markers whenever the map is initialized or the located events change.
    effect(() => {
      if (!this.mapReady()) return;
      this.renderMarkers(this.markerGroups());
    });

    // Swap the basemap when the app theme flips. Markers are DOM overlays, so
    // they survive setStyle and don't need re-adding.
    effect(() => {
      const url = this.themeService.isDark() ? DARK_STYLE_URL : LIGHT_STYLE_URL;
      if (this.map && url !== this.currentStyleUrl) {
        this.currentStyleUrl = url;
        this.map.setStyle(url);
      }
    });
  }

  ngOnInit(): void {
    const employeeId = this.route.snapshot.paramMap.get('employeeId');
    const date = this.route.snapshot.queryParamMap.get('date') ?? undefined;
    if (!employeeId) return;
    this.employeeId = employeeId;
    this.selectedDate = date;

    this.loadDay(date);
    this.attendanceService.updates$
      .pipe(auditTime(500), takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        const selectedDate = this.selectedDate ?? this.todayLabel();
        const targeted = Boolean(update.affected?.length);
        const affectsEmployee = update.affected?.some(
          (target) => target.employeeId === this.employeeId && target.date === selectedDate,
        ) ?? false;
        if ((targeted ? affectsEmployee : this.isSelectedDateToday()) &&
            this.document.visibilityState === 'visible') {
          this.loadDay(this.selectedDate, true);
        }
      });
  }

  ngAfterViewInit(): void {
    this.currentStyleUrl = this.themeService.isDark() ? DARK_STYLE_URL : LIGHT_STYLE_URL;
    this.map = new MaplibreMap({
      container: this.mapContainer().nativeElement,
      style: this.currentStyleUrl,
      center: [122, 12],
      zoom: 5,
      attributionControl: false,
    });

    this.map.addControl(
      new NavigationControl({ showCompass: false, showZoom: true }),
      'top-right',
    );

    this.map.on('load', () => this.mapReady.set(true));
    this.map.on('zoom', () => this.applyMarkerScale());

    this.destroyRef.onDestroy(() => {
      this.markers.forEach(({ marker }) => marker.remove());
      this.map?.remove();
      this.map = null;
    });
  }

  goBack(): void {
    this.location.back();
  }

  private loadDay(date: string | undefined, silent = false): void {
    if (!silent) this.isLoading.set(true);
    this.attendanceService
      .getEmployeeDay(this.employeeId, date)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          if (!silent) this.isLoading.set(false);
        }),
      )
      .subscribe({
        next: (summary) => this.summary.set(summary),
        error: (err: unknown) => console.error('Error loading employee attendance:', err),
      });
  }

  private isSelectedDateToday(): boolean {
    if (!this.selectedDate) return true;
    return this.selectedDate === this.todayLabel();
  }

  private todayLabel(): string {
    const now = new Date();
    return `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
  }

  private renderMarkers(groups: MarkerGroup[]): void {
    if (!this.map) return;

    this.markers.forEach(({ marker }) => marker.remove());
    this.markers = [];

    if (groups.length === 0) return;

    const bounds = new LngLatBounds();

    for (const group of groups) {
      const element = this.buildMarkerElement(group);
      const popup = new Popup({
        offset: [group.offset[0], group.offset[1] - 18],
        closeButton: false,
        closeOnClick: false,
      }).setHTML(this.popupHtml(group));

      const marker = new Marker({ element, anchor: 'center', offset: group.offset })
        .setLngLat(group.lngLat)
        .addTo(this.map);

      element.addEventListener('mouseenter', () => popup.setLngLat(group.lngLat).addTo(this.map!));
      element.addEventListener('mouseleave', () => popup.remove());

      this.markers.push({ marker, popup, base: group.offset });
      bounds.extend(group.lngLat);
    }

    this.applyMarkerScale();
    this.map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 600 });
  }

  /**
   * Keep markers honest at every zoom:
   *  - the dot + label shrink as you zoom out, so the marker stays a tiny point
   *    sitting on its real coordinate instead of a big floating pill;
   *  - the fan-out offset that separates co-located work-types collapses as you
   *    zoom out, so punches at the same spot converge into one place (and only
   *    spread apart once you're zoomed in close enough to tell them apart).
   */
  private applyMarkerScale(): void {
    if (!this.map) return;
    const zoom = this.map.getZoom();

    // zoom 3 (continent view) → 0.25, zoom 13+ (street view) → 1.0, clamped.
    const sizeScale = Math.min(1, Math.max(0.25, 0.25 + ((zoom - 3) * 0.75) / 10));
    // Fan stays collapsed across city zoom and only opens up at building level.
    const fanScale = Math.min(1, Math.max(0, (zoom - 13) / 4));

    for (const { marker, popup, base } of this.markers) {
      marker.getElement().style.setProperty('--marker-scale', sizeScale.toFixed(2));
      const offset: [number, number] = [base[0] * fanScale, base[1] * fanScale];
      marker.setOffset(offset);
      popup.setOffset([offset[0], offset[1] - 18]);
    }
  }

  /** A colored dot with a text pill, plus a count badge when punches are grouped. */
  private buildMarkerElement(group: MarkerGroup): HTMLElement {
    const el = this.document.createElement('div');
    el.className = 'proximity-marker';
    el.style.setProperty('--dot', group.color);

    const label = this.document.createElement('span');
    label.className = 'proximity-label';
    label.textContent = group.label;

    const dot = this.document.createElement('span');
    dot.className = 'proximity-dot';

    // Show the punch count inside the dot itself, rather than as a floating badge.
    if (group.items.length > 1) {
      dot.classList.add('proximity-dot--counted');
      dot.textContent = String(group.items.length);
    }

    el.append(label, dot);
    return el;
  }

  private markerColor(event: AttendanceEvent): string {
    if (event.origin === 'BIOMETRICS') return SOURCE_COLORS.BIOMETRIC;
    if (event.source === 'FIELD') return SOURCE_COLORS.FIELD;
    if (event.source === 'WFH') return SOURCE_COLORS.WFH;
    return SOURCE_COLORS.OFFICE_MANUAL;
  }

  /** Short work-type name shown on the pill, matching the marker color. */
  private workTypeLabel(event: AttendanceEvent): string {
    if (event.origin === 'BIOMETRICS') return 'Biometric';
    if (event.source === 'FIELD') return 'Field';
    if (event.source === 'WFH') return 'WFH';
    return 'Office';
  }

  private popupHtml(group: MarkerGroup): string {
    const rows = group.items
      .map(({ event, label }) => {
        const time = new Date(event.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `<span>${time} · ${label} · ${event.source}</span>`;
      })
      .join('');

    const heading =
      group.items.length === 1
        ? `${group.label} · ${group.items[0].label}`
        : `${group.label} · ${group.items.length} punches`;
    const coords = `${group.lngLat[1].toFixed(5)}, ${group.lngLat[0].toFixed(5)}`;

    return `
      <div class="map-popup">
        <strong>${heading}</strong>
        ${rows}
        <small>${coords}</small>
      </div>
    `;
  }

  eventTypeLabel(eventType: AttendanceEventType): string {
    const labels: Record<AttendanceEventType, string> = {
      OFFICE_ACCESS: 'Office Access',
      OFFICE_IN: 'Office In',
      OFFICE_OUT: 'Office Out',
      FIELD_IN: 'Field In',
      FIELD_OUT: 'Field Out',
      WFH_IN: 'WFH In',
      WFH_OUT: 'WFH Out',
    };
    return labels[eventType] ?? eventType;
  }

  sourceSeverity(source: string): 'info' | 'success' | 'warn' {
    const map: Record<string, 'info' | 'success' | 'warn'> = {
      OFFICE: 'info',
      FIELD: 'warn',
      WFH: 'success',
    };
    return map[source] ?? 'info';
  }
}

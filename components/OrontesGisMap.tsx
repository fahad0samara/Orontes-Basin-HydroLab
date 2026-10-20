'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type * as LType from 'leaflet';
import {
  HydroSimulationResult,
  RasterLayerType,
  BASIN_BOUNDS,
  CANAL_BREACH_HOTSPOTS,
  HISTORICAL_FLOOD_EVENTS,
  ORONTES_MAIN_LATLON,
  EAST_CANAL_LATLON,
  WEST_CANAL_LATLON,
  WESTERN_WADIS_LATLON,
  RURAL_ROADS_LATLON,
  gridToLatLon,
  latLonToGrid,
  getCellTelemetry,
  getBasinCellGeometry,
  computePolylineLengthKm,
  analyzeCustomPolygonRoi,
  computeCustomCrossSectionProfile,
  getTemporalFloodWaveMultiplier,
  CellTelemetry,
} from '@/lib/orontes-hydro-engine';
import {
  PARCEL_ARABIC_DATA,
  CROSSING_ARABIC_DATA,
  BREACH_ARABIC_DATA,
  HISTORICAL_EVENT_ARABIC_DATA,
  LAYER_ARABIC_DEFINITIONS,
  translateRiskClassAr,
  translateCrossingStatusAr,
} from '@/lib/orontes-arabic-i18n';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Filter,
  Maximize2,
  Minimize2,
  MousePointer,
  PenTool,
  Ruler,
  Trash2,
  BookOpen,
  SplitSquareHorizontal,
  Columns2,
  MapPin,
  Activity,
  Clock,
} from 'lucide-react';

export interface MapSyncRegistry {
  maps: Record<string, LType.Map | null>;
  isSyncing: boolean;
  activeDriverId?: string | null;
  hoverListeners?: Record<string, (cell: { col: number; row: number } | null) => void>;
}

export interface ScenarioMapHeaderInfo {
  id: 'A' | 'B';
  badge: string;
  title: string;
  floodKm2: number;
  deltaKm2?: number;
  croplandHa: number;
  overtoppedCount: number;
  isActiveEditor: boolean;
  onSelectEditor: () => void;
  isSecondarySplitPane?: boolean;
  customLayerOverride?: RasterLayerType | 'sync';
  onChangeLayerOverride?: (layer: RasterLayerType | 'sync') => void;
}

export type BaseMapStyle = 'satellite' | 'shaded' | 'topo' | 'dark' | 'osm';
type GisToolMode = 'inspect' | 'measure-area' | 'measure-dist' | 'profile-line';

interface OrontesGisMapProps {
  mapId?: string;
  syncRegistryRef?: React.MutableRefObject<MapSyncRegistry>;
  scenarioHeader?: ScenarioMapHeaderInfo;
  sim: HydroSimulationResult;
  peerSim?: HydroSimulationResult;
  peerFsiThreshold?: number;
  activeLayer: RasterLayerType;
  peerActiveLayer?: RasterLayerType;
  onSelectLayer: (layer: RasterLayerType) => void;
  fsiThreshold: number;
  activeBreachIds: string[];
  onToggleBreach: (breachId: string) => void;
  selectedCell: { col: number; row: number };
  onSelectCell: (col: number, row: number) => void;
  selectedCrossingId: string | null;
  onSelectCrossing: (id: string | null) => void;
  selectedParcelId: string | null;
  onSelectParcel: (id: string | null) => void;
  showHistoricalExtent: boolean;
  onToggleHistoricalExtent: (show?: boolean) => void;
  selectedHistoricalEventId: string;
  onSelectHistoricalEventId?: (eventId: string) => void;
  simplifiedMode?: boolean;
  swipeModeActive?: boolean;
  swipePercent?: number;
  onSwipePercentChange?: (pct: number) => void;
  sharedHoverCell?: { col: number; row: number } | null;
  onSharedHoverCellChange?: (cell: { col: number; row: number } | null) => void;
  baseMapProp?: BaseMapStyle;
  onBaseMapChange?: (bm: BaseMapStyle) => void;
  rasterOpacityProp?: number;
  onRasterOpacityChange?: (op: number) => void;
  showLandmarksProp?: boolean;
  onShowLandmarksChange?: (show: boolean) => void;
  activeFloodWaveHour?: number | null;
  onResetFloodWaveHour?: () => void;
}

const ORONTES_BASIN_LANDMARKS: {
  id: string;
  nameAr: string;
  subtitleAr: string;
  elevationM: number;
  lat: number;
  lon: number;
  category: 'city' | 'hydraulic' | 'terrain';
}[] = [
  {
    id: 'lm-karkor',
    nameAr: 'سد ومضيق قرقور',
    subtitleAr: 'المخرج الهيدروليكي الشمالي للغاب',
    elevationM: 168,
    lat: 35.748,
    lon: 36.332,
    category: 'hydraulic',
  },
  {
    id: 'lm-jisr',
    nameAr: 'جسر الشغور',
    subtitleAr: 'ممر نهر العاصي الشمالي',
    elevationM: 170,
    lat: 35.792,
    lon: 36.322,
    category: 'city',
  },
  {
    id: 'lm-ziyarah',
    nameAr: 'سهل الزيارة',
    subtitleAr: 'حوض التجمع الزراعي الأوسط',
    elevationM: 173,
    lat: 35.642,
    lon: 36.342,
    category: 'city',
  },
  {
    id: 'lm-shathah',
    nameAr: 'شطحة ومروحتها الغرينية',
    subtitleAr: 'مخروط انصباب السيول الجبلية الغربية',
    elevationM: 192,
    lat: 35.535,
    lon: 36.252,
    category: 'hydraulic',
  },
  {
    id: 'lm-qalaat',
    nameAr: 'قلعة المضيق (أفاميا)',
    subtitleAr: 'الحافة الشرقية لسهل الغاب الأوسط',
    elevationM: 179,
    lat: 35.422,
    lon: 36.395,
    category: 'city',
  },
  {
    id: 'lm-suqaylabiyah',
    nameAr: 'السقيلبية',
    subtitleAr: 'المركز الزراعي الجنوبي لحوض الغاب',
    elevationM: 186,
    lat: 35.368,
    lon: 36.388,
    category: 'city',
  },
  {
    id: 'lm-asharne',
    nameAr: 'سدة العشارنة التنظيمية',
    subtitleAr: 'بوابة دخول نهر العاصي الجنوبية',
    elevationM: 190,
    lat: 35.288,
    lon: 36.398,
    category: 'hydraulic',
  },
  {
    id: 'lm-ansariyah',
    nameAr: 'جبال اللاذقية (النصيرية)',
    subtitleAr: 'الجرف الانكساري الغربي شديد الانحدار',
    elevationM: 1080,
    lat: 35.575,
    lon: 36.228,
    category: 'terrain',
  },
  {
    id: 'lm-zawiya',
    nameAr: 'هضبة جبل الزاوية الشرقية',
    subtitleAr: 'المرتفعات الكلسية الشرقية',
    elevationM: 465,
    lat: 35.605,
    lon: 36.442,
    category: 'terrain',
  },
];

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * clamped),
    Math.round(c1[1] + (c2[1] - c1[1]) * clamped),
    Math.round(c1[2] + (c2[2] - c1[2]) * clamped),
  ];
}

function getRampColor(
  t: number,
  stops: { pos: number; color: [number, number, number] }[]
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].pos && clamped <= stops[i + 1].pos) {
      const localT =
        (clamped - stops[i].pos) / Math.max(1e-6, stops[i + 1].pos - stops[i].pos);
      return lerpColor(stops[i].color, stops[i + 1].color, localT);
    }
  }
  return stops[stops.length - 1].color;
}

export interface LegendClassBand {
  bandIndex: number;
  color: string;
  range: string;
  label: string;
  detail: string;
  cellCount: number;
  areaKm2: number;
  areaHa: number;
  pctOfBasin: number;
  meanElevM: number;
  meanDepthM: number;
  matchCell: (idx: number) => boolean;
}

export interface RasterLayerLegendSpec {
  id: RasterLayerType;
  shortName: string;
  label: string;
  unit: string;
  formulaNote: string;
  minLabel: string;
  midLabel: string;
  maxLabel: string;
  ticks: string[];
  gradientCss: string;
  getClasses: (
    sim: HydroSimulationResult,
    fsiThreshold: number,
    peerSim?: HydroSimulationResult,
    isScenarioB?: boolean
  ) => LegendClassBand[];
  getCellReading: (
    telemetry: CellTelemetry,
    sim?: HydroSimulationResult,
    peerSim?: HydroSimulationResult,
    isScenarioB?: boolean
  ) => {
    formattedValue: string;
    subValue?: string;
    normalizedPct: number;
  };
}

/**
 * Resolves Scenario A (baseline) and Scenario B (comparison) consistently regardless
 * of whether the caller is Map A (sim=A, peerSim=B) or Map B (sim=B, peerSim=A).
 */
function resolveScenarioPair(
  sim: HydroSimulationResult,
  peerSim?: HydroSimulationResult,
  isScenarioB?: boolean
): { baseSim: HydroSimulationResult; compSim: HydroSimulationResult } {
  if (!peerSim) return { baseSim: sim, compSim: sim };
  return isScenarioB
    ? { baseSim: peerSim, compSim: sim }
    : { baseSim: sim, compSim: peerSim };
}

/**
 * Computes live dynamic area (km², ha, and % of basin), cell count, mean elevation,
 * and mean water depth from the simulation raster cells so zero class stats are hardcoded.
 */
function computeDynamicBands(
  sim: HydroSimulationResult,
  bandDefs: {
    color: string;
    range: string;
    label: string;
    detail: string;
    matchCell: (idx: number) => boolean;
  }[]
): LegendClassBand[] {
  const { cellAreaKm2 } = getBasinCellGeometry();
  const totalCells = sim.cols * sim.rows;
  const counts = new Int32Array(bandDefs.length);
  const elevSums = new Float64Array(bandDefs.length);
  const depthSums = new Float64Array(bandDefs.length);

  for (let idx = 0; idx < totalCells; idx++) {
    for (let b = 0; b < bandDefs.length; b++) {
      if (bandDefs[b].matchCell(idx)) {
        counts[b]++;
        elevSums[b] += sim.conditionedDem[idx];
        depthSums[b] += sim.waterDepthM[idx];
        break;
      }
    }
  }

  return bandDefs.map((def, b) => {
    const c = counts[b];
    const safeC = Math.max(1, c);
    const areaKm2 = Number((c * cellAreaKm2).toFixed(1));
    const areaHa = Math.round(areaKm2 * 100);
    const pctOfBasin = Number(((c / Math.max(1, totalCells)) * 100).toFixed(1));
    return {
      bandIndex: b,
      color: def.color,
      range: def.range,
      label: def.label,
      detail: def.detail,
      cellCount: c,
      areaKm2,
      areaHa,
      pctOfBasin,
      meanElevM: Number((elevSums[b] / safeC).toFixed(1)),
      meanDepthM: Number((depthSums[b] / safeC).toFixed(2)),
      matchCell: def.matchCell,
    };
  });
}

function getBandPreciseValueStats(
  sim: HydroSimulationResult,
  activeLayer: RasterLayerType,
  cls: LegendClassBand,
  peerSim?: HydroSimulationResult,
  isScenarioB?: boolean
): { minFormatted: string; meanFormatted: string; maxFormatted: string } {
  const totalCells = sim.cols * sim.rows;
  const { baseSim, compSim } = resolveScenarioPair(sim, peerSim, isScenarioB);
  let minV = Infinity;
  let maxV = -Infinity;
  let sumV = 0;
  let count = 0;

  for (let i = 0; i < totalCells; i++) {
    if (!cls.matchCell(i)) continue;
    let v = 0;
    switch (activeLayer) {
      case 'fsi':
        v = sim.fsi[i];
        break;
      case 'depth':
        v = sim.waterDepthM[i];
        break;
      case 'deltaDepth':
        v = compSim.waterDepthM[i] - baseSim.waterDepthM[i];
        break;
      case 'velocity':
        v = sim.velocityMs[i];
        break;
      case 'twi':
        v = sim.twi[i];
        break;
      case 'dem':
        v = sim.conditionedDem[i];
        break;
      case 'slope':
        v = sim.slopePct[i];
        break;
      case 'flowAcc':
        v = sim.flowAcc[i];
        break;
      case 'chirps':
        v = sim.chirps[i];
        break;
      case 'gfs48h':
        v = sim.gfs48h[i];
        break;
      case 'clay':
        v = sim.clay[i];
        break;
      case 'canalDist':
        v = sim.canalDistKm[i];
        break;
    }
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    sumV += v;
    count++;
  }

  if (count === 0) {
    return { minFormatted: '—', meanFormatted: '—', maxFormatted: '—' };
  }

  const meanV = sumV / count;
  const fmt = (val: number) => {
    switch (activeLayer) {
      case 'fsi':
        return `${val.toFixed(2)} FSI`;
      case 'depth':
        return `${val.toFixed(2)} m`;
      case 'deltaDepth':
        return `${val >= 0 ? '+' : ''}${val.toFixed(2)} m`;
      case 'velocity':
        return `${val.toFixed(2)} m/s`;
      case 'twi':
        return `${val.toFixed(1)} TWI`;
      case 'dem':
        return `${Math.round(val)} m`;
      case 'slope':
        return `${val.toFixed(1)}%`;
      case 'flowAcc':
        return `${Math.round(val).toLocaleString()} cells`;
      case 'chirps':
        return `${Math.round(val)} mm`;
      case 'gfs48h':
        return `${val.toFixed(1)} mm`;
      case 'clay':
        return `${val.toFixed(0)}%`;
      case 'canalDist':
        return `${val.toFixed(2)} km`;
    }
  };

  return {
    minFormatted: fmt(minV),
    meanFormatted: fmt(meanV),
    maxFormatted: fmt(maxV),
  };
}

export const RASTER_LAYER_SPECS: RasterLayerLegendSpec[] = [
  {
    id: 'fsi',
    shortName: 'مؤشر القابلية للفيضان (FSI)',
    label: 'مؤشر القابلية للفيضان المركب (Flood Susceptibility Index)',
    unit: 'مؤشر معياري [٠.٠٠–١.٠٠]',
    formulaNote:
      'FSI = w₁·TWI + w₂·CHIRPS + w₃·Clay + w₄·CanalProx — تراكب هيدرولوجي موزون متعدد المعايير يدمج الرطوبة الطبوغرافية، الهطول المطري، طين الفيرتيسول، والقرب من المصارف.',
    minLabel: '0.00 منخفض',
    midLabel: '0.55 متوسط',
    maxLabel: '1.00 حرج جداً',
    ticks: ['0.00', '0.35', '0.65', '0.84', '1.00'],
    gradientCss:
      'linear-gradient(90deg, #0f172a 0%, #0e7490 35%, #0284c7 52%, #f59e0b 68%, #e11d48 85%, #881337 100%)',
    getClasses: (sim, fsiThreshold) =>
      computeDynamicBands(sim, [
        {
          color: '#e11d48',
          range: `≥ ${(fsiThreshold + 0.12).toFixed(2)}`,
          label: 'نطاق فيضاني حرج جداً (Critical Flood Zone)',
          detail: 'غمر عميق (>1.2 م) وارتداد مائي خلفي مع طفح انكسارات السدود',
          matchCell: (i) => sim.fsi[i] >= fsiThreshold + 0.12,
        },
        {
          color: '#f59e0b',
          range: `${fsiThreshold.toFixed(2)} – ${(fsiThreshold + 0.11).toFixed(2)}`,
          label: 'قابلية مرتفعة للفيضان (High Susceptibility)',
          detail: 'سهل فيضي نشط وامتلاء يفوق قدرة المصارف الفرعية (0.4–1.2 م)',
          matchCell: (i) =>
            sim.fsi[i] >= fsiThreshold && sim.fsi[i] < fsiThreshold + 0.12,
        },
        {
          color: '#0284c7',
          range: `0.38 – ${Math.max(0.39, fsiThreshold - 0.01).toFixed(2)}`,
          label: 'رطوبة وتشبع متوسط (Moderate Wetness)',
          detail: 'جريان صفائحي موسمي وتشبع للتربة الطينية دون غمر عميق',
          matchCell: (i) => sim.fsi[i] >= 0.38 && sim.fsi[i] < fsiThreshold,
        },
        {
          color: '#0f172a',
          range: '< 0.38',
          label: 'قابلية منخفضة / سفوح مرتفعة (Low / Upland)',
          detail: 'منحدرات جبلية وهضاب كلسية ذات تصريف جاذبي جيد',
          matchCell: (i) => sim.fsi[i] < 0.38,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.fsi.toFixed(2)} FSI`,
      subValue: `العمق ${t.inundationDepthM.toFixed(2)} م · الخطر: ${translateRiskClassAr(t.riskClass)}`,
      normalizedPct: Math.max(0, Math.min(100, t.fsi * 100)),
    }),
  },
  {
    id: 'depth',
    shortName: 'عمق الغمر المائي (م)',
    label: 'عمق الغمر المائي السطحي (Modeled Floodwater Ponding Depth)',
    unit: 'متر (م)',
    formulaNote:
      'h = [(Q·n)/(W·√S₀)]^(3/5) + Δh_silt — ارتفاع عمود الماء الفعلي فوق الحقول والطرق وفق معادلة ماننغ وإطماء القنوات.',
    minLabel: '0.00م جاف',
    midLabel: '1.20م عميق',
    maxLabel: '2.80م+ غمر شديد',
    ticks: ['0.0m', '0.3m', '0.9m', '1.8m', '2.8m'],
    gradientCss:
      'linear-gradient(90deg, #0b0f19 0%, #0284c7 22%, #38bdf8 48%, #f59e0b 75%, #e11d48 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#e11d48',
          range: '≥ 1.50 م',
          label: 'غمر مائي كارثي عميق (Extreme Deep Ponding)',
          detail: 'غمر كامل للمنشآت وارتداد مائي خلفي أمام مضيق قرقور',
          matchCell: (i) => sim.waterDepthM[i] >= 1.5,
        },
        {
          color: '#f59e0b',
          range: '0.60 – 1.49 م',
          label: 'غمر عميق للحيازات الزراعية (Deep Polder Inundation)',
          detail: 'تلف المحاصيل الشتوية وانقطاع الطرق الزراعية الفرعية',
          matchCell: (i) => sim.waterDepthM[i] >= 0.6 && sim.waterDepthM[i] < 1.5,
        },
        {
          color: '#38bdf8',
          range: '0.15 – 0.59 م',
          label: 'غمر سطحي ضحل وغدق (Shallow Sheet Flooding)',
          detail: 'تجمع المياه في الأخاديد الزراعية واختناق منطقة الجذور',
          matchCell: (i) => sim.waterDepthM[i] >= 0.15 && sim.waterDepthM[i] < 0.6,
        },
        {
          color: '#0b0f19',
          range: '< 0.15 م',
          label: 'جاف / غير مغمور (Dry / Non-Inundated)',
          detail: 'أعلى من منسوب سطح مياه الفيضان النشط',
          matchCell: (i) => sim.waterDepthM[i] < 0.15,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.inundationDepthM.toFixed(2)} م`,
      subValue: `منسوب الماء ${(t.conditionedElevationM + t.inundationDepthM).toFixed(1)} م عن البحر`,
      normalizedPct: Math.max(
        0,
        Math.min(100, (t.inundationDepthM / 2.8) * 100)
      ),
    }),
  },
  {
    id: 'deltaDepth',
    shortName: 'فارق العمق بين السيناريوهين (Δh)',
    label: 'فارق عمق الفيضان والمخاطر (السيناريو ب − السيناريو أ)',
    unit: 'متر (Δم)',
    formulaNote:
      'Δh = h_B − h_A — اللون الأخضر الزمردي يعني انحسار الفيضان ونجاح التجريف؛ اللون الوردي/الأحمر يعني زيادة عمق الغمر.',
    minLabel: '-1.5م انحسار',
    midLabel: '0.0م مستقر',
    maxLabel: '+1.5م توسع',
    ticks: ['-1.5m', '-0.5m', '0.0m', '+0.5m', '+1.5m'],
    gradientCss:
      'linear-gradient(90deg, #059669 0%, #34d399 28%, #1e293b 50%, #f59e0b 72%, #e11d48 100%)',
    getClasses: (sim, _fsiThreshold, peerSim, isScenarioB) => {
      const { baseSim, compSim } = resolveScenarioPair(sim, peerSim, isScenarioB);
      return computeDynamicBands(compSim, [
        {
          color: '#10b981',
          range: '≤ -0.25 م',
          label: 'انحسار قوي للفيضان (Strong Flood Mitigation)',
          detail: 'تجريف القنوات وإصلاح السدود يقضي على التجمعات المائية العميقة',
          matchCell: (i) => compSim.waterDepthM[i] - baseSim.waterDepthM[i] <= -0.25,
        },
        {
          color: '#34d399',
          range: '-0.24 إلى -0.05 م',
          label: 'انخفاض متوسط في عمق الغمر (Moderate Reduction)',
          detail: 'انخفاض منسوب المياه وتقليل الغدق الزراعي في الحقول',
          matchCell: (i) => {
            const d = compSim.waterDepthM[i] - baseSim.waterDepthM[i];
            return d > -0.25 && d <= -0.05;
          },
        },
        {
          color: '#1e293b',
          range: '-0.04 إلى +0.04 م',
          label: 'تغير طفيف / حالة مستقرة (Negligible Change)',
          detail: 'مناطق مرتفعة مستقرة أو تطابق بين السيناريوهين',
          matchCell: (i) =>
            Math.abs(compSim.waterDepthM[i] - baseSim.waterDepthM[i]) < 0.05,
        },
        {
          color: '#e11d48',
          range: '≥ +0.05 م',
          label: 'زيادة وتفاقم في عمق الفيضان (Increased Depth)',
          detail: 'ارتفاع إضافي في منسوب الغمر أو طفح انكسار جديد',
          matchCell: (i) => compSim.waterDepthM[i] - baseSim.waterDepthM[i] >= 0.05,
        },
      ]);
    },
    getCellReading: (t, sim, peerSim, isScenarioB) => {
      if (!sim || !peerSim) {
        return {
          formattedValue: '0.00 م Δ',
          subValue: 'فارق العمق بين السيناريو (ب) والسيناريو (أ)',
          normalizedPct: 50,
        };
      }
      const { baseSim, compSim } = resolveScenarioPair(sim, peerSim, isScenarioB);
      const idx = t.row * sim.cols + t.col;
      const dDepth = compSim.waterDepthM[idx] - baseSim.waterDepthM[idx];
      const dFsi = compSim.fsi[idx] - baseSim.fsi[idx];
      const sign = dDepth > 0 ? '+' : '';
      const fsiSign = dFsi > 0 ? '+' : '';
      return {
        formattedValue: `${sign}${dDepth.toFixed(2)} م (ب − أ)`,
        subValue: `${fsiSign}${dFsi.toFixed(2)} ΔFSI (${
          dDepth < -0.04 ? 'تحسن وانحسار' : dDepth > 0.04 ? 'تفاقم الغمر' : 'مستقر'
        })`,
        normalizedPct: Math.max(
          0,
          Math.min(100, ((dDepth + 1.5) / 3.0) * 100)
        ),
      };
    },
  },
  {
    id: 'velocity',
    shortName: 'سرعة الجريان (ماننغ م/ث)',
    label: 'سرعة الجريان الهيدروليكي وإجهاد القص القاعي (Manning Velocity & τ)',
    unit: 'م/ث · إجهاد القص (Pa)',
    formulaNote:
      'v = (1/n)·R^(2/3)·S^(1/2) | τ = ρ·g·h·S — السرعة المتجهة للمياه وإجهاد حتّ التربة والضفاف.',
    minLabel: '0.0 م/ث ركود',
    midLabel: '1.5 م/ث سريع',
    maxLabel: '3.5+ م/ث جارف',
    ticks: ['0.0m/s', '0.4m/s', '1.2m/s', '2.2m/s', '3.5m/s+'],
    gradientCss:
      'linear-gradient(90deg, #0b0f19 0%, #0f766e 25%, #06b6d4 50%, #f59e0b 78%, #e11d48 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#e11d48',
          range: '≥ 2.20 م/ث',
          label: 'سيول جبلية جارفة عالية الطاقة (High-Energy Wadi Scour)',
          detail: 'جريان فوق حرج يسبب حتّ أكتاف القنوات وتآكل دعامات الجسور (τ > 120 Pa)',
          matchCell: (i) => sim.velocityMs[i] >= 2.2,
        },
        {
          color: '#f59e0b',
          range: '1.00 – 2.19 م/ث',
          label: 'جريان نشط في القنوات والمخارج (Active Channel Conveyance)',
          detail: 'تدفق سريع في مجرى العاصي ومخارج الأودية الغربية',
          matchCell: (i) => sim.velocityMs[i] >= 1.0 && sim.velocityMs[i] < 2.2,
        },
        {
          color: '#06b6d4',
          range: '0.25 – 0.99 م/ث',
          label: 'جريان سهلي دون حرج (Subcritical Sheetflow)',
          detail: 'تدفق معتدل فوق السهل الفيضي وداخل المصارف المجمعة',
          matchCell: (i) => sim.velocityMs[i] >= 0.25 && sim.velocityMs[i] < 1.0,
        },
        {
          color: '#0b0f19',
          range: '< 0.25 م/ث',
          label: 'مياه راكدة / ارتداد خلفي بطيء (Stagnant Backwater)',
          detail: 'ركود مائي في المنخفضات الطينية يؤدي لترسب الطمي (n ≈ 0.055)',
          matchCell: (i) => sim.velocityMs[i] < 0.25,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.flowVelocityMs.toFixed(2)} م/ث`,
      subValue: `معامل ماننغ n=${t.manningsN.toFixed(3)} · القص τ=${t.shearStressPa.toFixed(1)} Pa`,
      normalizedPct: Math.max(
        0,
        Math.min(100, (t.flowVelocityMs / 3.5) * 100)
      ),
    }),
  },
  {
    id: 'flowAcc',
    shortName: 'تراكم الجريان السطحي (D8)',
    label: 'تراكم الجريان السطحي بثمانية اتجاهات (D8 Flow Accumulation)',
    unit: 'خلية صبّابة · صبيب (م³/ث)',
    formulaNote:
      'A_i = 1 + ∑ A_upslope — توجيه الجريان الهيدرولوجي (D8) عبر نموذج الارتفاعات المعالج من العشارنة إلى قرقور.',
    minLabel: '1 خلية',
    midLabel: '250 خلية',
    maxLabel: '5,000+ خلية',
    ticks: ['1', '25', '250', '1.5k', '5k+'],
    gradientCss:
      'linear-gradient(90deg, #0b0f19 0%, #1d4ed8 38%, #38bdf8 72%, #ffffff 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#ffffff',
          range: '≥ 400 خلية',
          label: 'المجرى الرئيسي لنهر العاصي (Orontes Main Stem)',
          detail: 'الشريان النهري الجامع ومخرج مضيق قرقور (>150 م³/ث)',
          matchCell: (i) => sim.flowAcc[i] >= 400,
        },
        {
          color: '#38bdf8',
          range: '80 – 399 خلية',
          label: 'القنوات والمصارف المجمعة الرئيسية (Main Canals)',
          detail: 'قناتا الغاب الشرقية والغربية والمصارف الكبرى (35–150 م³/ث)',
          matchCell: (i) => sim.flowAcc[i] >= 80 && sim.flowAcc[i] < 400,
        },
        {
          color: '#1d4ed8',
          range: '12 – 79 خلية',
          label: 'مسيلات الأودية الجبلية الغربية (Western Wadi Chutes)',
          detail: 'روافد السيول الخاطفة من جبل النصيرية (5–35 م³/ث)',
          matchCell: (i) => sim.flowAcc[i] >= 12 && sim.flowAcc[i] < 80,
        },
        {
          color: '#0b0f19',
          range: '1 – 11 خلية',
          label: 'جريان سفحي أولي (Hillslope Sheetflow)',
          detail: 'بدايات تشكل الجريان السطحي المحلي (<5 م³/ث)',
          matchCell: (i) => sim.flowAcc[i] < 12,
        },
      ]),
    getCellReading: (t) => {
      const logNorm = Math.log10(Math.max(1, t.flowAccumulationCells)) / 3.7;
      const estQ = (
        Math.pow(t.flowAccumulationCells, 0.62) *
        (t.chirpsMm / 110) *
        1.4
      ).toFixed(1);
      return {
        formattedValue: `${t.flowAccumulationCells.toLocaleString()} خلية`,
        subValue: `~${estQ} م³/ث · حوض صبّاب ${t.upslopeAreaKm2.toFixed(1)} كم²`,
        normalizedPct: Math.max(0, Math.min(100, logNorm * 100)),
      };
    },
  },
  {
    id: 'twi',
    shortName: 'مؤشر الرطوبة الطبوغرافية (TWI)',
    label: 'مؤشر الرطوبة الطبوغرافية (Beven-Kirkby TWI = ln(a / tanβ))',
    unit: 'ln(m) [٥.٠–١٩.٥]',
    formulaNote:
      'TWI = ln(a / tan β) — النسبة اللوغاريتمية بين المساحة الصبّابة النوعية (a) وظل زاوية الميل (tan β).',
    minLabel: '5.0 قمة جبلية',
    midLabel: '12.2 سفح',
    maxLabel: '19.5 قاع السهل',
    ticks: ['5.0', '8.5', '12.5', '16.0', '19.5'],
    gradientCss:
      'linear-gradient(90deg, #111827 0%, #0f766e 35%, #06b6d4 68%, #bae6fd 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#bae6fd',
          range: '15.0 – 21.5',
          label: 'منخفضات بحيرية ومستنقعات قديمة (Lacustrine Depression)',
          detail: 'قاع سهل الغاب المستوي ذو التشبع المائي الأقصى',
          matchCell: (i) => sim.twi[i] >= 15.0,
        },
        {
          color: '#06b6d4',
          range: '11.5 – 14.9',
          label: 'أقدام المراوح الغرينية (Alluvial Toe-Slope)',
          detail: 'مناطق تلاقي السيول عند أطراف السهل الفيضي',
          matchCell: (i) => sim.twi[i] >= 11.5 && sim.twi[i] < 15.0,
        },
        {
          color: '#0f766e',
          range: '8.2 – 11.4',
          label: 'سفوح انتقالية متوسطة الرطوبة (Colluvial Footslope)',
          detail: 'احتفاظ متوسط برطوبة التربة على المصاطب',
          matchCell: (i) => sim.twi[i] >= 8.2 && sim.twi[i] < 11.5,
        },
        {
          color: '#111827',
          range: '< 8.2',
          label: 'جروف ومنحدرات جبلية شديدة التصريف (Steep Escarpment)',
          detail: 'تصريف سريع لمياه الأمطار نحو الأسفل',
          matchCell: (i) => sim.twi[i] < 8.2,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.twi.toFixed(1)} ln(m)`,
      subValue: `الميل الطبوغرافي: ${t.slopeDeg.toFixed(2)}°`,
      normalizedPct: Math.max(0, Math.min(100, ((t.twi - 5.0) / 14.5) * 100)),
    }),
  },
  {
    id: 'dem',
    shortName: 'نموذج الارتفاعات الرقمي (DEM)',
    label: 'نموذج الارتفاعات الرقمي المعالج هيدرولوجياً (Conditioned DEM)',
    unit: 'متر فوق سطح البحر',
    formulaNote:
      'Z_cond = PlanchonDarboux(Z_raw) — تضاريس الأخدود التكتوني لسهل الغاب بعد ملء الفجوات المغلقة.',
    minLabel: '167م قاع الغاب',
    midLabel: '520م هضبة',
    maxLabel: '1,100م قمم الساحل',
    ticks: ['167m', '240m', '480m', '800m', '1100m'],
    gradientCss:
      'linear-gradient(90deg, #064e3b 0%, #166534 10%, #65a30d 22%, #ca8a04 45%, #9a3412 74%, #f1f5f9 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#f1f5f9',
          range: '≥ 700 م',
          label: 'قمم سلسلة جبل النصيرية (Jabal Ansariyah Crest)',
          detail: 'خط تقسيم المياه الجبلي الغربي المطل على الغاب',
          matchCell: (i) => sim.conditionedDem[i] >= 700,
        },
        {
          color: '#ca8a04',
          range: '260 – 699 م',
          label: 'هضبة جبل الزاوية والسفوح الانكسارية (Uplands & Scarps)',
          detail: 'المرتفعات الكلسية الشرقية والحواف الصدعية',
          matchCell: (i) =>
            sim.conditionedDem[i] >= 260 && sim.conditionedDem[i] < 700,
        },
        {
          color: '#38bdf8',
          range: 'ΔZ > 0.05 م',
          label: 'أحواض مغلقة معالجة هيدرولوجياً (Conditioned Sink Fill)',
          detail: 'منخفضات طبوغرافية دقيقة تم ملؤها لضمان استمرارية الجريان',
          matchCell: (i) =>
            sim.conditionedDem[i] < 260 &&
            sim.conditionedDem[i] - sim.rawDem[i] > 0.05,
        },
        {
          color: '#166534',
          range: '165 – 259 م',
          label: 'قاع أخدود سهل الغاب الزراعي (Al-Ghab Graben Floor)',
          detail: 'السهل الرسوبي المنبسط الممتد على طول نهر العاصي',
          matchCell: (i) =>
            sim.conditionedDem[i] < 260 &&
            sim.conditionedDem[i] - sim.rawDem[i] <= 0.05,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.conditionedElevationM.toFixed(1)} م عن البحر`,
      subValue:
        t.sinkDepthFilledM > 0.05
          ? `تم ملء فجوة بعمق +${t.sinkDepthFilledM.toFixed(2)} م`
          : 'منسوب طبيعي غير مملوء',
      normalizedPct: Math.max(
        0,
        Math.min(100, ((t.conditionedElevationM - 165) / 920) * 100)
      ),
    }),
  },
  {
    id: 'slope',
    shortName: 'نسبة انحدار التضاريس (Slope %)',
    label: 'نسبة انحدار التضاريس والتراكم المائي (Terrain Slope % = tan β × 100%)',
    unit: 'نسبة مئوية (%) · درجة (°)',
    formulaNote:
      'S% = tan(β) × 100% = (ΔZ / ΔL) × 100 — ارتباط عكسي قوي مع التراكم المائي (FlowAcc): قاع الغاب (<1.5%) يجمع السيول القادمة من الجروف (>25%).',
    minLabel: '0.0% مستوٍ',
    midLabel: '8.0% مروحة',
    maxLabel: '50%+ جرف',
    ticks: ['0.0%', '1.5%', '6.0%', '20%', '50%+'],
    gradientCss:
      'linear-gradient(90deg, #064e3b 0%, #0d9488 18%, #eab308 48%, #ea580c 78%, #f8fafc 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#ea580c',
          range: '≥ 20.0% (≥ 11.3°)',
          label: 'جرف صدعي شديد الانحدار (Steep Fault Escarpment)',
          detail: 'توليد سيول جارفة سريعة (SPI مرتفع · تراكم خلايا منخفض)',
          matchCell: (i) => sim.slopePct[i] >= 20.0,
        },
        {
          color: '#eab308',
          range: '6.0% – 19.9% (3.4°–11.2°)',
          label: 'مراوح غرينية عند أقدام الجبال (Alluvial Piedmont Fan)',
          detail: 'مخاريط انصباب الأودية وتباطؤ السرعة وترسيب الطمي',
          matchCell: (i) => sim.slopePct[i] >= 6.0 && sim.slopePct[i] < 20.0,
        },
        {
          color: '#0d9488',
          range: '1.5% – 5.9% (0.86°–3.3°)',
          label: 'مصاطب زراعية خفيفة الميل (Gently Sloping Terrace)',
          detail: 'تجمع انتقالي للجريان السطحي نحو المصارف الرئيسية',
          matchCell: (i) => sim.slopePct[i] >= 1.5 && sim.slopePct[i] < 6.0,
        },
        {
          color: '#064e3b',
          range: '< 1.5% (< 0.86°)',
          label: 'قاع سهل الغاب المستوي (Flat Ponding & High FlowAcc)',
          detail: 'انحدار شبه صفري + تراكم مائي أقصى = بؤرة الغمر الفيضي',
          matchCell: (i) => sim.slopePct[i] < 1.5,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.slopePct.toFixed(2)}% (${t.slopeDeg.toFixed(2)}°)`,
      subValue: `تراكم الجريان: ${t.flowAccumulationCells.toLocaleString()} خلية · SPI: ${t.streamPowerIndex.toFixed(1)}`,
      normalizedPct: Math.max(0, Math.min(100, (t.slopePct / 50) * 100)),
    }),
  },
  {
    id: 'chirps',
    shortName: 'أمطار العاصفة (CHIRPS مم)',
    label: 'الهطول المطري الفضائي والرفع التضاريسي (CHIRPS v2.0 Rainfall)',
    unit: 'مم / العاصفة',
    formulaNote:
      'P(x,y) = P_peak · OrographicLift(Z) — توزيع أمطار العاصفة مع تعزيز الرفع التضاريسي فوق السلسلة الساحلية.',
    minLabel: '35 مم شرقاً',
    midLabel: '120 مم بالسهل',
    maxLabel: '210 مم بالقمم',
    ticks: ['35mm', '80mm', '125mm', '170mm', '210mm'],
    gradientCss:
      'linear-gradient(90deg, #1e3a8a 0%, #0284c7 42%, #22d3ee 72%, #fde047 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#fde047',
          range: '≥ 155 مم',
          label: 'نواة الرفع التضاريسي القصوى (Orographic Core)',
          detail: 'هطول مطري غزير جداً فوق قمم جبل النصيرية المواجهة للرياح',
          matchCell: (i) => sim.chirps[i] >= 155,
        },
        {
          color: '#22d3ee',
          range: '115 – 154 مم',
          label: 'أمطار غزيرة على الجروف الجبلية (Heavy Escarpment Rain)',
          detail: 'نطاق توليد السيول الخاطفة في أودية شطحة وجورين والسرمانية',
          matchCell: (i) => sim.chirps[i] >= 115 && sim.chirps[i] < 155,
        },
        {
          color: '#0284c7',
          range: '80 – 114 مم',
          label: 'أمطار متوسطة إلى غزيرة فوق السهل (Valley Rain)',
          detail: 'هطول مباشر فوق الحيازات الزراعية في بطن سهل الغاب',
          matchCell: (i) => sim.chirps[i] >= 80 && sim.chirps[i] < 115,
        },
        {
          color: '#1e3a8a',
          range: '< 80 مم',
          label: 'نطاق ظل المطر الشرقي النسبي (Eastern Rain Shadow)',
          detail: 'هطول أقل نسبياً فوق هضبة جبل الزاوية الشرقية',
          matchCell: (i) => sim.chirps[i] < 80,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.chirpsMm.toFixed(0)} مم`,
      subValue: `توقع GFS لـ ٤٨ ساعة: ${t.gfs48hMm.toFixed(1)} مم`,
      normalizedPct: Math.max(0, Math.min(100, ((t.chirpsMm - 35) / 175) * 100)),
    }),
  },
  {
    id: 'gfs48h',
    shortName: 'توقعات أمطار ٤٨ ساعة (GFS)',
    label: 'توقعات الأمطار الحية لـ ٤٨ ساعة (NOAA GFS 0.25° Live Forecast)',
    unit: 'مم / ٤٨ ساعة',
    formulaNote:
      'P_GFS = IDW(Slinfah, Masyaf, Jisr, Qalaat) · Ψ(Z) — استيفاء مكاني حي من ٤ محطات رصد.',
    minLabel: '0 مم جاف',
    midLabel: '35 مم بالسهل',
    maxLabel: '80+ مم بالقمم',
    ticks: ['0mm', '20mm', '40mm', '60mm', '80mm+'],
    gradientCss:
      'linear-gradient(90deg, #0f172a 0%, #0369a1 32%, #06b6d4 62%, #34d399 84%, #fde047 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#fde047',
          range: '≥ 45.0 مم',
          label: 'هطول غزير متوقع خلال ٤٨ ساعة (Heavy 48h GFS Downpour)',
          detail: 'جبهة مطرية نشطة فوق مرتفعات صلنفة ومصياف',
          matchCell: (i) => sim.gfs48h[i] >= 45,
        },
        {
          color: '#34d399',
          range: '30.0 – 44.9 مم',
          label: 'أمطار متوسطة على السفوح (Moderate Escarpment Rain)',
          detail: 'توليد جريان سطحي نشط في الأودية الغربية',
          matchCell: (i) => sim.gfs48h[i] >= 30 && sim.gfs48h[i] < 45,
        },
        {
          color: '#06b6d4',
          range: '15.0 – 29.9 مم',
          label: 'أمطار خفيفة إلى متوسطة بقاع الوادي (Valley Rain)',
          detail: 'هطول متوقع فوق الأراضي الزراعية خلال ٤٨ ساعة',
          matchCell: (i) => sim.gfs48h[i] >= 15 && sim.gfs48h[i] < 30,
        },
        {
          color: '#0369a1',
          range: '< 15.0 مم',
          label: 'هطول طفيف / استقرار جوي (Light / Dry)',
          detail: 'تراكم مطري منخفض خلال الـ ٤٨ ساعة القادمة',
          matchCell: (i) => sim.gfs48h[i] < 15,
        },
      ]),
    getCellReading: (t) => {
      const diff = t.gfs48hMm - t.chirpsMm;
      return {
        formattedValue: `${t.gfs48hMm.toFixed(1)} مم (٤٨ س)`,
        subValue: `مقارنة بالعاصفة: ${diff >= 0 ? '+' : ''}${diff.toFixed(0)} مم (${t.chirpsMm.toFixed(0)} مم)`,
        normalizedPct: Math.max(0, Math.min(100, (t.gfs48hMm / 80) * 100)),
      };
    },
  },
  {
    id: 'clay',
    shortName: 'نسبة الطين والفيرتيسول (Clay %)',
    label: 'محتوى التربة من الطين البحيري الكتيم (Lacustrine Vertisol Clay %)',
    unit: 'نسبة الطين (%)',
    formulaNote:
      'K_sat ∝ exp(-0.085·Clay%) — تتحكم نسبة الطين في منع الرشح العميق وطول فترة ركود المياه في الحقول.',
    minLabel: '15% كلسية',
    midLabel: '45% لومية',
    maxLabel: '75% طين ثقيل',
    ticks: ['15%', '30%', '45%', '60%', '75%'],
    gradientCss:
      'linear-gradient(90deg, #27272a 0%, #78350f 42%, #d97706 75%, #fef08a 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#fef08a',
          range: '≥ 58% طين',
          label: 'طين فيرتيسول ثقيل كتيم (Heavy Vertisol Clay)',
          detail: 'قاع المستنقعات القديمة — غدق زراعي طويل الأمد (>72 ساعة)',
          matchCell: (i) => sim.clay[i] >= 58,
        },
        {
          color: '#d97706',
          range: '44 – 57% طين',
          label: 'تربة طينية سلتية ضعيفة النفاذية (Silty Clay Loam)',
          detail: 'تربة السهل الفيضي الزراعية ذات الرشح البطيء',
          matchCell: (i) => sim.clay[i] >= 44 && sim.clay[i] < 58,
        },
        {
          color: '#78350f',
          range: '28 – 43% طين',
          label: 'تربة المراوح الغرينية اللومية (Alluvial Fan Loam)',
          detail: 'نفاذية متوسطة على أطراف السهل والمصاطب',
          matchCell: (i) => sim.clay[i] >= 28 && sim.clay[i] < 44,
        },
        {
          color: '#27272a',
          range: '< 28% طين',
          label: 'تربة كلسية وحصوية نفوذة (Limestone Regolith)',
          detail: 'منحدرات كارستية وصخرية ذات رشح سريع',
          matchCell: (i) => sim.clay[i] < 28,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.soilClayPct.toFixed(0)}% طين`,
      subValue:
        t.soilClayPct >= 55 ? 'صرف ضعيف جداً (فيرتيسول كتيم)' : 'نفاذية متوسطة إلى جيدة',
      normalizedPct: Math.max(0, Math.min(100, ((t.soilClayPct - 15) / 60) * 100)),
    }),
  },
  {
    id: 'canalDist',
    shortName: 'القرب من العاصي والقنوات (كم)',
    label: 'المسافة الهيدروليكية عن نهر العاصي وشبكة المصارف (Canal Proximity)',
    unit: 'كيلومتر (كم)',
    formulaNote:
      'D_min = min(d_Orontes, d_East, d_West) — المسافة الجيوديسية لتحديد نطاق طفح الضفاف وانكسار السدود.',
    minLabel: '0.0 كم الضفة',
    midLabel: '2.5 كم السهل',
    maxLabel: '7.5 كم الأطراف',
    ticks: ['0.0km', '1.2km', '2.8km', '5.0km', '7.5km'],
    gradientCss:
      'linear-gradient(90deg, #38bdf8 0%, #0284c7 25%, #1e293b 65%, #090d16 100%)',
    getClasses: (sim) =>
      computeDynamicBands(sim, [
        {
          color: '#38bdf8',
          range: '0.0 – 1.2 كم',
          label: 'نطاق الطفح المباشر لضفاف القنوات (Overbank Corridor)',
          detail: 'الأراضي المحاذية مباشرة لنهر العاصي والقنوات الرئيسية',
          matchCell: (i) => sim.canalDistKm[i] <= 1.2,
        },
        {
          color: '#0284c7',
          range: '1.2 – 2.8 كم',
          label: 'أحواض السهل الفيضي الداخلي (Inner Floodplain Polders)',
          detail: 'معرضة لارتداد مياه المصارف وطفح السدود الترابية',
          matchCell: (i) => sim.canalDistKm[i] > 1.2 && sim.canalDistKm[i] <= 2.8,
        },
        {
          color: '#1e293b',
          range: '2.8 – 5.0 كم',
          label: 'مصاطب السهل الخارجي (Outer Plain Terrace)',
          detail: 'تأثر غير مباشر بارتفاع منسوب القنوات الرئيسية',
          matchCell: (i) => sim.canalDistKm[i] > 2.8 && sim.canalDistKm[i] <= 5.0,
        },
        {
          color: '#090d16',
          range: '> 5.0 كم',
          label: 'المرتفعات خارج نطاق القنوات (Upland Escarpment)',
          detail: 'بعيدة عن نطاق الفيضان النهري المباشر',
          matchCell: (i) => sim.canalDistKm[i] > 5.0,
        },
      ]),
    getCellReading: (t) => ({
      formattedValue: `${t.canalDistKm.toFixed(2)} كم`,
      subValue:
        t.canalDistKm < 1.2 ? 'نطاق طفح ضفاف مباشر' : 'حرم السهل الفيضي',
      normalizedPct: Math.max(
        0,
        Math.min(100, (Math.min(7.5, t.canalDistKm) / 7.5) * 100)
      ),
    }),
  },
];

interface DynamicLegendProps {
  activeSpec: RasterLayerLegendSpec;
  activeLayer: RasterLayerType;
  onSelectLayer: (layer: RasterLayerType) => void;
  fsiThreshold: number;
  telemetry: CellTelemetry;
  showHistoricalExtent: boolean;
  onToggleHistoricalExtent: (show?: boolean) => void;
  diffMatrixMode: boolean;
  activeHistYear: number;
  sim: HydroSimulationResult;
  peerSim?: HydroSimulationResult;
  maskLowFsi: boolean;
  onToggleMaskLowFsi: () => void;
  showRasterLayer: boolean;
  onToggleRasterLayer: () => void;
  hoveredBandIdx: number | null;
  onHoverBandIdx: (idx: number | null) => void;
  hiddenBandIndices: number[];
  onToggleBandVisibility: (idx: number) => void;
  onResetBandVisibility: () => void;
  showWaterways: boolean;
  onToggleWaterways: () => void;
  showParcels: boolean;
  onToggleParcels: () => void;
  showCrossings: boolean;
  onToggleCrossings: () => void;
  showBreachPoints: boolean;
  onToggleBreachPoints: () => void;
  showFlowVectors: boolean;
  onToggleFlowVectors: () => void;
  showContours: boolean;
  onToggleContours: () => void;
  showGraticule: boolean;
  onToggleGraticule: () => void;
  showLandmarks: boolean;
  onToggleLandmarks: () => void;
  activeBreachCount: number;
  slopeFlowOverlayMode?: boolean;
  onToggleSlopeFlowOverlayMode?: () => void;
  slopeMaxFilterPct?: number;
  onSlopeMaxFilterPctChange?: (val: number) => void;
  onSelectCell?: (col: number, row: number) => void;
  compactDefault?: boolean;
  peerTelemetry?: CellTelemetry | null;
  isScenarioB?: boolean;
  isHoveringMap?: boolean;
  onMouseEnterLegend?: () => void;
}

function OrontesDynamicLegend({
  activeSpec,
  activeLayer,
  onSelectLayer,
  fsiThreshold,
  telemetry,
  showHistoricalExtent,
  onToggleHistoricalExtent,
  diffMatrixMode,
  activeHistYear,
  sim,
  peerSim,
  maskLowFsi,
  onToggleMaskLowFsi,
  showRasterLayer,
  onToggleRasterLayer,
  hoveredBandIdx,
  onHoverBandIdx,
  hiddenBandIndices,
  onToggleBandVisibility,
  onResetBandVisibility,
  showWaterways,
  onToggleWaterways,
  showParcels,
  onToggleParcels,
  showCrossings,
  onToggleCrossings,
  showBreachPoints,
  onToggleBreachPoints,
  showFlowVectors,
  onToggleFlowVectors,
  showContours,
  onToggleContours,
  showGraticule,
  onToggleGraticule,
  showLandmarks,
  onToggleLandmarks,
  activeBreachCount,
  slopeFlowOverlayMode = true,
  onToggleSlopeFlowOverlayMode,
  slopeMaxFilterPct = 60,
  onSlopeMaxFilterPctChange,
  onSelectCell,
  compactDefault = false,
  peerTelemetry = null,
  isScenarioB = false,
  isHoveringMap = false,
  onMouseEnterLegend,
}: DynamicLegendProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [legendTab, setLegendTab] = useState<'classes' | 'layers' | 'definition'>('classes');
  const [hoveredVectorId, setHoveredVectorId] = useState<string | null>(null);

  const layerArDef = LAYER_ARABIC_DEFINITIONS[activeLayer];

  const classes = useMemo(() => {
    if (showHistoricalExtent && diffMatrixMode) {
      return computeDynamicBands(sim, [
        {
          color: '#e11d48',
          range: `النموذج ∩ ${activeHistYear}`,
          label: 'تطابق فيضاني مزمن (Chronic Overlap)',
          detail: 'تطابق بين الغمر المتوقع في النموذج والرصد الراداري لسنتينل-١',
          matchCell: (i) =>
            sim.fsi[i] >= fsiThreshold && sim.historicalMask[i] === 1,
        },
        {
          color: '#f59e0b',
          range: `النموذج \\ ${activeHistYear}`,
          label: 'توسع جديد للفيضان (New Expansion)',
          detail: 'مناطق يتوقع النموذج غمرها خارج نطاق الرصد التاريخي',
          matchCell: (i) =>
            sim.fsi[i] >= fsiThreshold && sim.historicalMask[i] === 0,
        },
        {
          color: '#38bdf8',
          range: `${activeHistYear} \\ النموذج`,
          label: `رصد تاريخي فقط (${activeHistYear})`,
          detail: 'مناطق غُمرت تاريخياً لكنها آمنة في السيناريو الحالي',
          matchCell: (i) =>
            sim.fsi[i] < fsiThreshold && sim.historicalMask[i] === 1,
        },
        {
          color: '#0f172a',
          range: 'آمن في كليهما',
          label: 'مرتفعات وأراضٍ غير مغمورة',
          detail: 'خارج نطاق الفيضان في كل من النموذج والرصد الراداري',
          matchCell: (i) =>
            sim.fsi[i] < fsiThreshold && sim.historicalMask[i] === 0,
        },
      ]);
    }
    return activeSpec.getClasses(sim, fsiThreshold, peerSim, isScenarioB);
  }, [
    activeSpec,
    sim,
    fsiThreshold,
    peerSim,
    isScenarioB,
    showHistoricalExtent,
    diffMatrixMode,
    activeHistYear,
  ]);

  const reading = activeSpec.getCellReading(telemetry, sim, peerSim, isScenarioB);

  const hoveredBandStats = useMemo(() => {
    if (hoveredBandIdx === null || !classes[hoveredBandIdx]) return null;
    const cls = classes[hoveredBandIdx];
    const valStats = getBandPreciseValueStats(
      sim,
      showHistoricalExtent && diffMatrixMode ? 'fsi' : activeLayer,
      cls,
      peerSim,
      isScenarioB
    );
    return { cls, valStats };
  }, [
    hoveredBandIdx,
    classes,
    sim,
    activeLayer,
    peerSim,
    isScenarioB,
    showHistoricalExtent,
    diffMatrixMode,
  ]);

  const vectorLayers = useMemo(
    () => [
      {
        id: 'raster',
        label: `الطبقة الشبكية: ${activeSpec.shortName}`,
        swatchColor: '#38bdf8',
        symbol: '■',
        active: showRasterLayer,
        onToggle: onToggleRasterLayer,
        badge: showRasterLayer ? 'مرئية' : 'مخفية',
        preciseSummary: `شبكة 110×150 (16,500 خلية) · ${activeSpec.label}`,
        preciseMetrics: `نطاق الخطر المرتفع: ${sim.summary.highRiskAreaKm2} كم² (${sim.summary.highRiskAreaPct}%) · أقصى سرعة: ${sim.summary.maxBasinVelocityMs} م/ث`,
      },
      {
        id: 'rivers',
        label: 'نهر العاصي والقنوات والأودية (٨)',
        swatchColor: '#22d3ee',
        symbol: '━',
        active: showWaterways,
        onToggle: onToggleWaterways,
        badge: '٨ مجاري',
        preciseSummary:
          '٦٠ كم مجرى نهر العاصي + القناتان الشرقية والغربية + ٥ أودية جبلية',
        preciseMetrics: `ذروة صبيب مخرج قرقور: ${sim.summary.peakKarkorOutflowM3s} م³/ث · زمن التأخر: ${sim.summary.karkorLagTimeHours} ساعة`,
      },
      {
        id: 'farms',
        label: 'الحيازات والأحواض الزراعية (٧)',
        swatchColor: '#34d399',
        symbol: '▢',
        active: showParcels,
        onToggle: onToggleParcels,
        badge: `${sim.parcelImpacts.length} أحواض`,
        preciseSummary: `الأراضي الزراعية المغمورة: ${sim.summary.inundatedCroplandHa.toLocaleString()} من ${sim.summary.totalCroplandHa.toLocaleString()} هكتار (${sim.summary.inundatedCroplandPct}%)`,
        preciseMetrics: `الحمل الرسوبي: ${sim.summary.totalSedimentTonsDay.toLocaleString()} طن/يوم · متوسط النترات: ${sim.summary.meanBasinNitrateMgL} ملغ/لتر`,
      },
      {
        id: 'bridges',
        label: `الجسور والعبارات المائية (${sim.infrastructureImpacts.length})`,
        swatchColor: '#e11d48',
        symbol: '✖',
        active: showCrossings,
        onToggle: onToggleCrossings,
        badge: `${sim.summary.overtoppedCrossingsCount}/${sim.infrastructureImpacts.length} مغمور`,
        preciseSummary: `${sim.infrastructureImpacts.length} منشآت تقاطع: ${sim.summary.overtoppedCrossingsCount} مغمورة بالكامل · ${sim.summary.surchargedCrossingsCount} مضغوطة هيدروليكياً`,
        preciseMetrics: `أعلى ضغط هيدروليكي عند جسر سد قرقور (${sim.summary.peakKarkorOutflowM3s} م³/ث)`,
      },
      {
        id: 'breaches',
        label: 'بؤر انكسار السدود وطفح القنوات (٥)',
        swatchColor: '#f59e0b',
        symbol: '◆',
        active: showBreachPoints,
        onToggle: onToggleBreachPoints,
        badge: `${activeBreachCount}/5 نشط`,
        preciseSummary: `${activeBreachCount} من أصل ${CANAL_BREACH_HOTSPOTS.length} بؤر انكسار نشطة حالياً`,
        preciseMetrics:
          'انقر على أي رمز ماسي على الخريطة لتفعيل الانكسار أو احتوائه هندسياً',
      },
      {
        id: 'sar',
        label: `رصد رادار سنتينل-١ (${activeHistYear})`,
        swatchColor: '#fbbf24',
        symbol: '---',
        active: showHistoricalExtent,
        onToggle: () => onToggleHistoricalExtent(),
        badge: `${sim.historicalComparison.hitRatePct}% تطابق`,
        preciseSummary: `المساحة المرصودة بالرادار (${activeHistYear}): ${sim.historicalComparison.observedAreaKm2} كم²`,
        preciseMetrics: `التقاطع المشترك: ${sim.historicalComparison.overlapAreaKm2} كم² · مؤشر النجاح CSI: ${sim.historicalComparison.criticalSuccessIndexPct}%`,
      },
      {
        id: 'vectors',
        label: 'متجهات اتجاه الجريان (D8 Vectors)',
        swatchColor: '#bae6fd',
        symbol: '▲',
        active: showFlowVectors,
        onToggle: onToggleFlowVectors,
        badge: `${sim.summary.maxBasinVelocityMs} م/ث`,
        preciseSummary:
          'أسهم اتجاه الانحدار الأشد (D8) للجريان السطحي والقنوات',
        preciseMetrics: `أقصى سرعة: ${sim.summary.maxBasinVelocityMs} م/ث · متوسط معامل ماننغ بالسهل: ${sim.summary.meanFloodplainManningN}`,
      },
      {
        id: 'contours',
        label: 'خطوط الكنتور والارتفاعات (DEM Contours)',
        swatchColor: '#e2e8f0',
        symbol: '≈',
        active: showContours,
        onToggle: onToggleContours,
        badge: '5م / 75م',
        preciseSummary:
          'خطوط تساوي الارتفاع (كل ٥ م في قاع سهل الغاب وكل ٧٥ م على الجروف الجبلية)',
        preciseMetrics: `الفجوات الطبوغرافية المملوءة: ${sim.summary.sinksFilledCount} منخفض (بمتوسط عمق ${sim.summary.meanSinkDepthM} م)`,
      },
      {
        id: 'landmarks',
        label: 'المعالم والمدن الجغرافية (٩)',
        swatchColor: '#38bdf8',
        symbol: '◉',
        active: showLandmarks,
        onToggle: onToggleLandmarks,
        badge: '٩ معالم',
        preciseSummary:
          'تسميات جغرافية للمدن والسدود والمرتفعات الرئيسية في حوض سهل الغاب',
        preciseMetrics:
          'تشمل قرقور، جسر الشغور، الزيارة، شطحة، قلعة المضيق، السقيلبية، والعشارنة',
      },
      {
        id: 'grid',
        label: 'شبكة الإحداثيات والمقطع العرضي (WGS84)',
        swatchColor: '#64748b',
        symbol: '⊞',
        active: showGraticule,
        onToggle: onToggleGraticule,
        badge: '35.51°N',
        preciseSummary:
          'شبكة إحداثيات حوض الغاب (35.24°N–35.80°N, 36.18°E–36.48°E)',
        preciseMetrics:
          'تشمل خط المقطع الجيولوجي العرضي (غرب–شرق) عند دائرة عرض 35.512° شمالاً',
      },
    ],
    [
      activeSpec,
      showRasterLayer,
      onToggleRasterLayer,
      sim,
      showWaterways,
      onToggleWaterways,
      showParcels,
      onToggleParcels,
      showCrossings,
      onToggleCrossings,
      showBreachPoints,
      onToggleBreachPoints,
      activeBreachCount,
      activeHistYear,
      showHistoricalExtent,
      onToggleHistoricalExtent,
      showFlowVectors,
      onToggleFlowVectors,
      showContours,
      onToggleContours,
      showLandmarks,
      onToggleLandmarks,
      showGraticule,
      onToggleGraticule,
    ]
  );

  const hoveredVectorSpec = useMemo(
    () => vectorLayers.find((v) => v.id === hoveredVectorId) || null,
    [vectorLayers, hoveredVectorId]
  );

  const depthA = isScenarioB
    ? peerTelemetry?.inundationDepthM ?? telemetry.inundationDepthM
    : telemetry.inundationDepthM;
  const depthB = isScenarioB
    ? telemetry.inundationDepthM
    : peerTelemetry?.inundationDepthM ?? telemetry.inundationDepthM;
  const deltaBA = depthB - depthA;

  return (
    <div
      dir="rtl"
      onMouseEnter={onMouseEnterLegend}
      className="absolute bottom-2 right-2 z-20 bg-[#0B0E17]/95 border border-[#1E293B] text-slate-200 font-sans text-xs w-[250px] max-w-[calc(100%-16px)] flex flex-col overflow-hidden shadow-lg pointer-events-auto"
    >
      {/* Compact Legend Header */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-[#111827] border-b border-[#1E293B] shrink-0">
        <span className="text-[11px] font-bold text-white truncate">
          {activeSpec.shortName}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {activeLayer === 'fsi' && (
            <button
              type="button"
              onClick={onToggleMaskLowFsi}
              className={`px-1.5 py-0.5 text-[9.5px] border whitespace-nowrap ${
                maskLowFsi
                  ? 'bg-sky-950/80 text-sky-300 border-sky-500/60'
                  : 'bg-[#0B0E17] text-slate-400 border-[#1E293B] hover:text-white'
              }`}
            >
              {maskLowFsi ? 'عزل الخطر' : 'كامل الحوض'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="px-1.5 py-0.5 text-[9.5px] text-sky-300 hover:text-white border border-[#1E293B] bg-[#0B0E17] inline-flex items-center gap-0.5"
          >
            <span>{isExpanded ? 'طي' : 'الفئات'}</span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronUp className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Color Ramp & Unit */}
      <div className="p-2 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-slate-300 truncate">{activeSpec.unit}</span>
          <span className="font-mono text-white font-semibold">
            {reading.formattedValue}
          </span>
        </div>

        <div className="space-y-1" dir="ltr">
          <div className="relative pt-1">
            <div
              className="absolute top-0 -translate-x-1/2 z-10 pointer-events-none"
              style={{ left: `${reading.normalizedPct}%` }}
            >
              <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-white" />
            </div>
            <div
              className="h-2 w-full border border-slate-600"
              style={{ background: activeSpec.gradientCss }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-mono tabular-nums">
            {activeSpec.ticks.map((tick, i) => (
              <span key={i}>{tick}</span>
            ))}
          </div>
        </div>

        {/* Simple 1-Click Correlation Toggle when Slope % Layer is Active */}
        {activeLayer === 'slope' && (
          <button
            type="button"
            onClick={onToggleSlopeFlowOverlayMode}
            className={`w-full py-1 px-2 text-[10px] border font-medium flex items-center justify-between transition-colors ${
              slopeFlowOverlayMode
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/60'
                : 'bg-[#07090E] text-slate-400 border-[#1E293B] hover:text-white'
            }`}
          >
            <span>دمج مسارات التراكم المائي</span>
            <span className="font-mono text-[9.5px]">
              {slopeFlowOverlayMode ? 'مفعّل ✓' : 'مخفي'}
            </span>
          </button>
        )}

        {/* Optional Collapsible 5-Class Breakdown */}
        {isExpanded && (
          <div className="pt-1.5 border-t border-[#1E293B] space-y-1">
            {classes.map((cls, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-1.5 text-[10px] px-1 py-0.5 bg-[#07090E]"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 shrink-0 border border-white/25"
                    style={{ backgroundColor: cls.color }}
                  />
                  <span className="text-slate-200 truncate">{cls.label}</span>
                </div>
                <span className="font-mono text-[9.5px] text-sky-300 shrink-0">
                  {cls.areaKm2.toFixed(1)} كم²
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrontesGisMap({
  mapId = 'map-primary',
  syncRegistryRef,
  scenarioHeader,
  sim,
  peerSim,
  peerFsiThreshold,
  activeLayer,
  peerActiveLayer,
  onSelectLayer,
  fsiThreshold,
  activeBreachIds,
  onToggleBreach,
  selectedCell,
  onSelectCell,
  selectedCrossingId,
  onSelectCrossing,
  selectedParcelId,
  onSelectParcel,
  showHistoricalExtent,
  onToggleHistoricalExtent,
  selectedHistoricalEventId,
  simplifiedMode = false,
  swipeModeActive = false,
  swipePercent = 50,
  onSwipePercentChange,
  sharedHoverCell = null,
  onSharedHoverCellChange,
  baseMapProp,
  onBaseMapChange,
  rasterOpacityProp,
  onRasterOpacityChange,
  showLandmarksProp,
  onShowLandmarksChange,
  activeFloodWaveHour = null,
  onResetFloodWaveHour,
}: OrontesGisMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<LType.Map | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const tileLayerRef = useRef<LType.TileLayer | null>(null);
  const rasterOverlayRef = useRef<LType.ImageOverlay | null>(null);
  const swipeOverlayRef = useRef<LType.ImageOverlay | null>(null);

  const vectorGroupRef = useRef<LType.LayerGroup | null>(null);
  const landmarksGroupRef = useRef<LType.LayerGroup | null>(null);
  const customDrawGroupRef = useRef<LType.LayerGroup | null>(null);
  const probeMarkerRef = useRef<LType.CircleMarker | null>(null);
  const sharedHoverMarkerRef = useRef<LType.CircleMarker | null>(null);

  const isScenarioB = scenarioHeader?.id === 'B';

  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [mapZoom, setMapZoom] = useState<number>(10);
  const [localBaseMap, setLocalBaseMap] = useState<BaseMapStyle>('satellite');
  const baseMap = baseMapProp ?? localBaseMap;
  const setBaseMap = useCallback(
    (next: BaseMapStyle) => {
      setLocalBaseMap(next);
      onBaseMapChange?.(next);
    },
    [onBaseMapChange]
  );

  const [localRasterOpacity, setLocalRasterOpacity] = useState<number>(0.72);
  const rasterOpacity = rasterOpacityProp ?? localRasterOpacity;
  const setRasterOpacity = useCallback(
    (next: number) => {
      setLocalRasterOpacity(next);
      onRasterOpacityChange?.(next);
    },
    [onRasterOpacityChange]
  );

  const [localShowLandmarks, setLocalShowLandmarks] = useState<boolean>(true);
  const showLandmarks = showLandmarksProp ?? localShowLandmarks;
  const setShowLandmarks = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(showLandmarks) : next;
      setLocalShowLandmarks(resolved);
      onShowLandmarksChange?.(resolved);
    },
    [showLandmarks, onShowLandmarksChange]
  );

  const [isDraggingSwipe, setIsDraggingSwipe] = useState<boolean>(false);
  const [showRasterLayer, setShowRasterLayer] = useState<boolean>(true);
  const [maskLowFsi, setMaskLowFsi] = useState<boolean>(true);
  const [diffMatrixMode, setDiffMatrixMode] = useState<boolean>(false);
  const [slopeFlowOverlayMode, setSlopeFlowOverlayMode] = useState<boolean>(true);
  const [slopeMaxFilterPct, setSlopeMaxFilterPct] = useState<number>(60);
  const [hoveredBandState, setHoveredBandState] = useState<{
    key: string;
    idx: number | null;
  }>({ key: '', idx: null });
  const [hiddenBandsByKey, setHiddenBandsByKey] = useState<
    Record<string, number[]>
  >({});

  const bandStateKey = `${activeLayer}-${diffMatrixMode}`;
  const hoveredBandIdx =
    hoveredBandState.key === bandStateKey ? hoveredBandState.idx : null;
  const setHoveredBandIdx = useCallback(
    (idx: number | null) => {
      setHoveredBandState({ key: bandStateKey, idx });
    },
    [bandStateKey]
  );

  const hiddenBandIndices = useMemo(
    () => hiddenBandsByKey[bandStateKey] || [],
    [hiddenBandsByKey, bandStateKey]
  );

  const handleToggleBandVisibility = useCallback(
    (bandIdx: number) => {
      setHiddenBandsByKey((prev) => {
        const current = prev[bandStateKey] || [];
        const next = current.includes(bandIdx)
          ? current.filter((i) => i !== bandIdx)
          : [...current, bandIdx];
        return { ...prev, [bandStateKey]: next };
      });
    },
    [bandStateKey]
  );

  const handleResetBandVisibility = useCallback(() => {
    setHiddenBandsByKey((prev) => ({ ...prev, [bandStateKey]: [] }));
  }, [bandStateKey]);

  // Vector & Advanced Layer Toggles (Clean cartographic defaults; all toggleable from the interactive legend)
  const [showWaterways, setShowWaterways] = useState<boolean>(true);
  const [showParcels, setShowParcels] = useState<boolean>(true);
  const [showCrossings, setShowCrossings] = useState<boolean>(true);
  const [showBreachPoints, setShowBreachPoints] = useState<boolean>(true);
  const [showFlowVectors, setShowFlowVectors] = useState<boolean>(false);
  const [showContours, setShowContours] = useState<boolean>(false);
  const [showGraticule, setShowGraticule] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(true);

  // Interactive GIS Tool Mode (Inspect vs Measure Area Polygon vs Measure Distance)
  const [gisToolMode, setGisToolMode] = useState<GisToolMode>('inspect');
  const [drawnVertices, setDrawnVertices] = useState<[number, number][]>([]);

  const [cursorCoords, setCursorCoords] = useState<{ col: number; row: number } | null>(
    null
  );
  const [peerHoverCoords, setPeerHoverCoords] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const lastHoverCellRef = useRef<{ col: number; row: number } | null>(null);

  const onSelectCellRef = useRef(onSelectCell);
  const onSelectCrossingRef = useRef(onSelectCrossing);
  const onSelectParcelRef = useRef(onSelectParcel);
  const onToggleBreachRef = useRef(onToggleBreach);
  const onSharedHoverCellChangeRef = useRef(onSharedHoverCellChange);
  const simplifiedModeRef = useRef(simplifiedMode);
  const gisToolModeRef = useRef<GisToolMode>(gisToolMode);

  useEffect(() => {
    onSelectCellRef.current = onSelectCell;
    onSelectCrossingRef.current = onSelectCrossing;
    onSelectParcelRef.current = onSelectParcel;
    onToggleBreachRef.current = onToggleBreach;
    onSharedHoverCellChangeRef.current = onSharedHoverCellChange;
    simplifiedModeRef.current = simplifiedMode;
    gisToolModeRef.current = gisToolMode;
  }, [
    onSelectCell,
    onSelectCrossing,
    onSelectParcel,
    onToggleBreach,
    onSharedHoverCellChange,
    simplifiedMode,
    gisToolMode,
  ]);

  const activeSpec =
    RASTER_LAYER_SPECS.find((s) => s.id === activeLayer) || RASTER_LAYER_SPECS[0];

  const activeHistEvent =
    HISTORICAL_FLOOD_EVENTS.find((e) => e.id === selectedHistoricalEventId) ||
    HISTORICAL_FLOOD_EVENTS[0];

  const activeHoverCoords = cursorCoords || peerHoverCoords || sharedHoverCell;
  const inspectedCoords =
    !simplifiedMode && activeHoverCoords ? activeHoverCoords : selectedCell;
  const telemetry: CellTelemetry = getCellTelemetry(
    sim,
    inspectedCoords.col,
    inspectedCoords.row,
    fsiThreshold
  );
  const resolvedPeerFsiThresh = peerFsiThreshold ?? fsiThreshold;
  const peerTelemetry: CellTelemetry | null = useMemo(
    () =>
      peerSim
        ? getCellTelemetry(
            peerSim,
            inspectedCoords.col,
            inspectedCoords.row,
            resolvedPeerFsiThresh
          )
        : null,
    [peerSim, inspectedCoords.col, inspectedCoords.row, resolvedPeerFsiThresh]
  );

  // Dynamically compute Custom Polygon ROI, Polyline Distance, or Custom Cross-Section Profile stats
  const customRoiStats = useMemo(() => {
    if (gisToolMode === 'measure-area' && drawnVertices.length >= 3) {
      return analyzeCustomPolygonRoi(sim, drawnVertices, fsiThreshold);
    }
    return null;
  }, [gisToolMode, drawnVertices, sim, fsiThreshold]);

  const customLineDistKm = useMemo(() => {
    if (drawnVertices.length >= 2) {
      return computePolylineLengthKm(drawnVertices);
    }
    return 0;
  }, [drawnVertices]);

  const [hoveredProfileSampleIdx, setHoveredProfileSampleIdx] = useState<number | null>(null);
  const customProfileAnalysis = useMemo(() => {
    if (gisToolMode === 'profile-line' && drawnVertices.length >= 2) {
      return computeCustomCrossSectionProfile(sim, drawnVertices, 48);
    }
    return null;
  }, [gisToolMode, drawnVertices, sim]);

  // Build Data URL from a hydrological simulation result with true 2D bilinear interpolation & organic watershed boundary
  const renderSimRasterToDataUrl = React.useCallback(
    (
      targetSim: HydroSimulationResult,
      refPeerSim?: HydroSimulationResult,
      layerToRender: RasterLayerType = activeLayer,
      targetFsiThreshold: number = fsiThreshold,
      targetIsScenarioB: boolean = isScenarioB
    ) => {
      if (!showRasterLayer) return TRANSPARENT_PIXEL;

      const scale = simplifiedMode ? 1 : 2;
      const outCols = targetSim.cols * scale;
      const outRows = targetSim.rows * scale;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = outCols;
      offCanvas.height = outRows;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return TRANSPARENT_PIXEL;

      const imgData = ctx.createImageData(outCols, outRows);
      const data = imgData.data;
      const hasHiddenBands =
        layerToRender === activeLayer && hiddenBandIndices.length > 0;
      const cols = targetSim.cols;
      const rows = targetSim.rows;
      const { baseSim, compSim } = resolveScenarioPair(
        targetSim,
        refPeerSim,
        targetIsScenarioB
      );

      const sampleBilinear = (
        arr: Float32Array,
        r0: number,
        c0: number,
        r1: number,
        c1: number,
        fr: number,
        fc: number
      ): number => {
        const v00 = arr[r0 * cols + c0];
        const v01 = arr[r0 * cols + c1];
        const v10 = arr[r1 * cols + c0];
        const v11 = arr[r1 * cols + c1];
        const top = v00 + (v01 - v00) * fc;
        const bot = v10 + (v11 - v10) * fc;
        return top + (bot - top) * fr;
      };

      for (let or = 0; or < outRows; or++) {
        const gfR = (or / Math.max(1, outRows - 1)) * (rows - 1);
        const r0 = Math.floor(gfR);
        const r1 = Math.min(rows - 1, r0 + 1);
        const fr = gfR - r0;
        const r = Math.min(rows - 1, Math.round(gfR));

        const ny = (gfR / Math.max(1, rows - 1)) * 2 - 1;
        const rowEdgeDist = Math.min(gfR, rows - 1 - gfR) / 5.5;

        for (let oc = 0; oc < outCols; oc++) {
          const gfC = (oc / Math.max(1, outCols - 1)) * (cols - 1);
          const c0 = Math.floor(gfC);
          const c1 = Math.min(cols - 1, c0 + 1);
          const fc = gfC - c0;
          const c = Math.min(cols - 1, Math.round(gfC));
          const idx = r * cols + c;
          const pIdx = (or * outCols + oc) * 4;

          // Organic Al-Ghab Rift Graben watershed envelope (eliminates artificial 90-degree rectangular corners)
          const nx = (gfC / Math.max(1, cols - 1)) * 2 - 1;
          const grabenDist =
            Math.pow(Math.abs(nx), 2.5) + Math.pow(Math.abs(ny), 3.2);
          const cornerFeather = Math.max(0, Math.min(1, (1.16 - grabenDist) / 0.28));
          const colEdgeDist = Math.min(gfC, cols - 1 - gfC) / 5.0;
          const edgeFeather = Math.min(
            1,
            rowEdgeDist,
            colEdgeDist,
            cornerFeather
          );

          if (edgeFeather <= 0.005) {
            data[pIdx + 3] = 0;
            continue;
          }

          let shade = 1.0;
          if (!simplifiedMode) {
            const zL = targetSim.conditionedDem[r * cols + Math.max(0, c - 1)];
            const zR = targetSim.conditionedDem[r * cols + Math.min(cols - 1, c + 1)];
            const zU = targetSim.conditionedDem[Math.max(0, r - 1) * cols + c];
            const zD = targetSim.conditionedDem[Math.min(rows - 1, r + 1) * cols + c];
            const dzdx = (zR - zL) / 496;
            const dzdy = (zD - zU) / 830;
            // Multi-directional Swiss cartographic hillshading (NW 315° + WSW ambient)
            const primaryShade = 1.0 - dzdx * 2.25 - dzdy * 1.65;
            const ambientShade = 1.0 - dzdx * 1.4 + dzdy * 0.65;
            shade = Math.max(
              0.7,
              Math.min(1.26, primaryShade * 0.8 + ambientShade * 0.2)
            );
          }

          let rgb: [number, number, number] = [15, 23, 42];
          let alpha = 255;

          const waveMult =
            activeFloodWaveHour !== null
              ? getTemporalFloodWaveMultiplier(targetSim, r, c, activeFloodWaveHour)
              : 1.0;

          if (showHistoricalExtent && diffMatrixMode) {
            const valFsi =
              sampleBilinear(targetSim.fsi, r0, c0, r1, c1, fr, fc) *
              (activeFloodWaveHour !== null ? 0.55 + 0.45 * waveMult : 1.0);
            const isMod = valFsi >= targetFsiThreshold;
            const isHist = targetSim.historicalMask[idx] === 1;
            if (isMod && isHist) {
              rgb = [225, 29, 72];
              alpha = Math.round(235 * edgeFeather);
            } else if (isMod && !isHist) {
              rgb = [245, 158, 11];
              alpha = Math.round(225 * edgeFeather);
            } else if (!isMod && isHist) {
              rgb = [56, 189, 248];
              alpha = Math.round(205 * edgeFeather);
            } else {
              rgb = [15, 23, 42];
              alpha = maskLowFsi ? 0 : Math.round(55 * edgeFeather);
            }
          } else if (layerToRender === 'fsi') {
            const rawFsi = sampleBilinear(targetSim.fsi, r0, c0, r1, c1, fr, fc);
            const val =
              activeFloodWaveHour !== null
                ? Math.min(1, rawFsi * (0.45 + 0.58 * waveMult))
                : rawFsi;
            rgb = getRampColor(val, [
              { pos: 0.0, color: [15, 23, 42] },
              { pos: 0.38, color: [14, 116, 144] },
              { pos: 0.52, color: [2, 132, 199] },
              { pos: targetFsiThreshold, color: [245, 158, 11] },
              { pos: 0.84, color: [225, 29, 72] },
              { pos: 1.0, color: [136, 19, 55] },
            ]);
            const cutoff = Math.max(0.36, targetFsiThreshold - 0.16);
            if (maskLowFsi) {
              if (val < cutoff) {
                alpha = 0;
              } else if (val < targetFsiThreshold) {
                const norm =
                  (val - cutoff) / Math.max(0.05, targetFsiThreshold - cutoff);
                alpha = Math.round(Math.pow(norm, 1.45) * 195 * edgeFeather);
              } else {
                alpha = Math.round(242 * edgeFeather);
              }
            } else {
              alpha = Math.round(
                (val >= targetFsiThreshold ? 240 : 165) * edgeFeather
              );
            }
          } else if (layerToRender === 'depth') {
            const d =
              sampleBilinear(targetSim.waterDepthM, r0, c0, r1, c1, fr, fc) *
              waveMult;
            const t = Math.min(1, d / 2.6);
            rgb = getRampColor(t, [
              { pos: 0.0, color: [14, 116, 144] },
              { pos: 0.15, color: [2, 132, 199] },
              { pos: 0.42, color: [56, 189, 248] },
              { pos: 0.72, color: [245, 158, 11] },
              { pos: 1.0, color: [225, 29, 72] },
            ]);
            if (maskLowFsi && d < 0.04) {
              alpha = 0;
            } else if (d < 0.22) {
              const ramp = Math.max(0, (d - 0.04) / 0.18);
              alpha = Math.round(Math.pow(ramp, 1.25) * 215 * edgeFeather);
            } else {
              alpha = Math.round(240 * edgeFeather);
            }
          } else if (layerToRender === 'deltaDepth') {
            const dDepth =
              (sampleBilinear(compSim.waterDepthM, r0, c0, r1, c1, fr, fc) -
                sampleBilinear(baseSim.waterDepthM, r0, c0, r1, c1, fr, fc)) *
              waveMult;
            const dFsi =
              (sampleBilinear(compSim.fsi, r0, c0, r1, c1, fr, fc) -
                sampleBilinear(baseSim.fsi, r0, c0, r1, c1, fr, fc)) *
              waveMult;
            const compositeDelta = dDepth + dFsi * 0.6;
            const norm = Math.max(0, Math.min(1, (compositeDelta + 1.2) / 2.4));
            rgb = getRampColor(norm, [
              { pos: 0.0, color: [5, 150, 105] },
              { pos: 0.35, color: [52, 211, 153] },
              { pos: 0.5, color: [30, 41, 59] },
              { pos: 0.68, color: [245, 158, 11] },
              { pos: 1.0, color: [225, 29, 72] },
            ]);
            const mag = Math.max(Math.abs(dDepth), Math.abs(dFsi));
            if (maskLowFsi && mag < 0.03) {
              alpha = 0;
            } else if (mag < 0.08) {
              alpha = Math.round(((mag - 0.03) / 0.05) * 210 * edgeFeather);
            } else {
              alpha = Math.round(235 * edgeFeather);
            }
          } else if (layerToRender === 'velocity') {
            const v =
              sampleBilinear(targetSim.velocityMs, r0, c0, r1, c1, fr, fc) *
              waveMult;
            const t = Math.min(1, v / 3.5);
            rgb = getRampColor(t, [
              { pos: 0.0, color: [11, 15, 25] },
              { pos: 0.18, color: [15, 118, 110] },
              { pos: 0.45, color: [6, 182, 212] },
              { pos: 0.75, color: [245, 158, 11] },
              { pos: 1.0, color: [225, 29, 72] },
            ]);
            if (maskLowFsi && v < 0.2) {
              alpha = 0;
            } else if (maskLowFsi && v < 0.45) {
              alpha = Math.round(((v - 0.2) / 0.25) * 215 * edgeFeather);
            } else {
              alpha = Math.round(235 * edgeFeather);
            }
          } else if (layerToRender === 'twi') {
            const twiVal = sampleBilinear(targetSim.twi, r0, c0, r1, c1, fr, fc);
            const t = (twiVal - 5.0) / 14.5;
            rgb = getRampColor(t, [
              { pos: 0.0, color: [17, 24, 39] },
              { pos: 0.35, color: [15, 118, 110] },
              { pos: 0.68, color: [6, 182, 212] },
              { pos: 1.0, color: [186, 230, 253] },
            ]);
            if (maskLowFsi && twiVal < 9.2) {
              alpha = Math.round(
                Math.max(0, (twiVal - 7.4) / 1.8) * 145 * edgeFeather
              );
            } else {
              alpha = Math.round(225 * edgeFeather);
            }
          } else if (layerToRender === 'dem') {
            const zCond = sampleBilinear(
              targetSim.conditionedDem,
              r0,
              c0,
              r1,
              c1,
              fr,
              fc
            );
            const zRaw = sampleBilinear(targetSim.rawDem, r0, c0, r1, c1, fr, fc);
            const t = (zCond - 165) / 920;
            rgb = getRampColor(t, [
              { pos: 0.0, color: [6, 78, 59] },
              { pos: 0.05, color: [22, 101, 52] },
              { pos: 0.18, color: [101, 163, 13] },
              { pos: 0.42, color: [202, 138, 4] },
              { pos: 0.72, color: [154, 52, 18] },
              { pos: 1.0, color: [241, 245, 249] },
            ]);
            if (zCond - zRaw > 0.12) {
              rgb = lerpColor(rgb, [56, 189, 248], 0.65);
            }
            alpha = Math.round(225 * edgeFeather);
          } else if (layerToRender === 'slope') {
            const slpPct = sampleBilinear(
              targetSim.slopePct,
              r0,
              c0,
              r1,
              c1,
              fr,
              fc
            );
            const fAcc = sampleBilinear(
              targetSim.flowAcc,
              r0,
              c0,
              r1,
              c1,
              fr,
              fc
            );
            // Non-linear perceptual stretch for Slope % so flat valley micro-gradients (0-2%) and scarps (15-50%+) are both crisp
            const t = Math.min(1, Math.pow(slpPct / 45.0, 0.65));
            rgb = getRampColor(t, [
              { pos: 0.0, color: [6, 78, 59] },
              { pos: 0.14, color: [13, 148, 136] },
              { pos: 0.36, color: [16, 185, 129] },
              { pos: 0.58, color: [234, 179, 8] },
              { pos: 0.82, color: [234, 88, 12] },
              { pos: 1.0, color: [248, 250, 252] },
            ]);

            // Optional Bivariate Correlation Overlay: highlight D8 flow accumulation convergence threads & flat-valley ponding sinks
            if (slopeFlowOverlayMode) {
              const logAcc = Math.log10(Math.max(1, fAcc));
              if (slpPct < 1.5 && logAcc >= 2.05) {
                const pondBlend = Math.min(0.82, (logAcc - 2.0) / 1.45);
                rgb = lerpColor(rgb, [56, 189, 248], pondBlend);
              } else if (logAcc >= 2.35) {
                const streamBlend = Math.min(0.7, (logAcc - 2.3) / 1.4);
                rgb = lerpColor(rgb, [186, 230, 253], streamBlend);
              }
            }

            if (slpPct > slopeMaxFilterPct) {
              alpha = Math.round(18 * edgeFeather);
            } else {
              alpha = Math.round(
                (maskLowFsi && slpPct < 1.5 && !slopeFlowOverlayMode ? 165 : 232) *
                  edgeFeather
              );
            }
          } else if (layerToRender === 'flowAcc') {
            const fAcc = sampleBilinear(targetSim.flowAcc, r0, c0, r1, c1, fr, fc);
            const logAcc = Math.log10(Math.max(1, fAcc)) / 3.7;
            rgb = getRampColor(logAcc, [
              { pos: 0.0, color: [11, 15, 25] },
              { pos: 0.38, color: [29, 78, 216] },
              { pos: 0.72, color: [56, 189, 248] },
              { pos: 1.0, color: [255, 255, 255] },
            ]);
            if (maskLowFsi && logAcc < 0.26) {
              alpha = 0;
            } else {
              alpha = Math.round(235 * edgeFeather);
            }
          } else if (layerToRender === 'chirps') {
            const chVal = sampleBilinear(targetSim.chirps, r0, c0, r1, c1, fr, fc);
            const t = (chVal - 35) / 175;
            rgb = getRampColor(t, [
              { pos: 0.0, color: [30, 58, 138] },
              { pos: 0.42, color: [2, 132, 199] },
              { pos: 0.72, color: [34, 211, 238] },
              { pos: 1.0, color: [253, 224, 71] },
            ]);
            alpha = Math.round(220 * edgeFeather);
          } else if (layerToRender === 'gfs48h') {
            const gVal = sampleBilinear(targetSim.gfs48h, r0, c0, r1, c1, fr, fc);
            const t = Math.min(1, gVal / 75);
            rgb = getRampColor(t, [
              { pos: 0.0, color: [15, 23, 42] },
              { pos: 0.25, color: [3, 105, 161] },
              { pos: 0.55, color: [6, 182, 212] },
              { pos: 0.8, color: [52, 211, 153] },
              { pos: 1.0, color: [253, 224, 71] },
            ]);
            if (maskLowFsi && gVal < 1.5) {
              alpha = 0;
            } else {
              alpha = Math.round(225 * edgeFeather);
            }
          } else if (layerToRender === 'clay') {
            const clVal = sampleBilinear(targetSim.clay, r0, c0, r1, c1, fr, fc);
            const t = (clVal - 15) / 60;
            rgb = getRampColor(t, [
              { pos: 0.0, color: [39, 39, 42] },
              { pos: 0.42, color: [120, 53, 15] },
              { pos: 0.75, color: [217, 119, 6] },
              { pos: 1.0, color: [254, 240, 138] },
            ]);
            if (maskLowFsi && clVal < 26) {
              alpha = Math.round(
                Math.max(0, (clVal - 18) / 8) * 160 * edgeFeather
              );
            } else {
              alpha = Math.round(225 * edgeFeather);
            }
          } else if (layerToRender === 'canalDist') {
            const cdVal = sampleBilinear(
              targetSim.canalDistKm,
              r0,
              c0,
              r1,
              c1,
              fr,
              fc
            );
            const t = Math.min(1, cdVal / 7.5);
            rgb = getRampColor(t, [
              { pos: 0.0, color: [56, 189, 248] },
              { pos: 0.25, color: [2, 132, 199] },
              { pos: 0.65, color: [30, 41, 59] },
              { pos: 1.0, color: [9, 13, 22] },
            ]);
            if (maskLowFsi && t > 0.45) {
              alpha = 0;
            } else {
              alpha = Math.round(225 * edgeFeather);
            }
          }

          // Determine category band index (0..3) for per-category visibility & hover spotlighting
          let cellBandIdx = 0;
          if (showHistoricalExtent && diffMatrixMode) {
            const isMod = targetSim.fsi[idx] >= targetFsiThreshold;
            const isHist = targetSim.historicalMask[idx] === 1;
            cellBandIdx =
              isMod && isHist
                ? 0
                : isMod && !isHist
                ? 1
                : !isMod && isHist
                ? 2
                : 3;
          } else if (layerToRender === 'fsi') {
            const v = targetSim.fsi[idx];
            cellBandIdx =
              v >= targetFsiThreshold + 0.12
                ? 0
                : v >= targetFsiThreshold
                ? 1
                : v >= 0.38
                ? 2
                : 3;
          } else if (layerToRender === 'depth') {
            const d = targetSim.waterDepthM[idx];
            cellBandIdx = d >= 1.5 ? 0 : d >= 0.6 ? 1 : d >= 0.15 ? 2 : 3;
          } else if (layerToRender === 'deltaDepth') {
            const d = compSim.waterDepthM[idx] - baseSim.waterDepthM[idx];
            cellBandIdx =
              d <= -0.25 ? 0 : d <= -0.05 ? 1 : Math.abs(d) < 0.05 ? 2 : 3;
          } else if (layerToRender === 'velocity') {
            const v = targetSim.velocityMs[idx];
            cellBandIdx = v >= 2.2 ? 0 : v >= 1.0 ? 1 : v >= 0.25 ? 2 : 3;
          } else if (layerToRender === 'flowAcc') {
            const f = targetSim.flowAcc[idx];
            cellBandIdx = f >= 400 ? 0 : f >= 80 ? 1 : f >= 12 ? 2 : 3;
          } else if (layerToRender === 'twi') {
            const t = targetSim.twi[idx];
            cellBandIdx = t >= 15.0 ? 0 : t >= 11.5 ? 1 : t >= 8.2 ? 2 : 3;
          } else if (layerToRender === 'dem') {
            const z = targetSim.conditionedDem[idx];
            const dz = z - targetSim.rawDem[idx];
            cellBandIdx = z >= 700 ? 0 : z >= 260 ? 1 : dz > 0.05 ? 2 : 3;
          } else if (layerToRender === 'slope') {
            const sPct = targetSim.slopePct[idx];
            cellBandIdx =
              sPct >= 20.0 ? 0 : sPct >= 6.0 ? 1 : sPct >= 1.5 ? 2 : 3;
          } else if (layerToRender === 'chirps') {
            const p = targetSim.chirps[idx];
            cellBandIdx = p >= 155 ? 0 : p >= 115 ? 1 : p >= 80 ? 2 : 3;
          } else if (layerToRender === 'gfs48h') {
            const g = targetSim.gfs48h[idx];
            cellBandIdx = g >= 45 ? 0 : g >= 30 ? 1 : g >= 15 ? 2 : 3;
          } else if (layerToRender === 'clay') {
            const cl = targetSim.clay[idx];
            cellBandIdx = cl >= 58 ? 0 : cl >= 44 ? 1 : cl >= 28 ? 2 : 3;
          } else if (layerToRender === 'canalDist') {
            const cd = targetSim.canalDistKm[idx];
            cellBandIdx = cd <= 1.2 ? 0 : cd <= 2.8 ? 1 : cd <= 5.0 ? 2 : 3;
          }

          // Optional Dynamic Elevation Isohypses (5m valley / 75m escarpment contours)
          if (showContours && c < cols - 1 && r < rows - 1) {
            const z0 = targetSim.conditionedDem[idx];
            const zRight = targetSim.conditionedDem[r * cols + (c + 1)];
            const zDown = targetSim.conditionedDem[(r + 1) * cols + c];
            const interval = z0 < 230 ? 5 : 75;
            if (
              Math.floor(z0 / interval) !== Math.floor(zRight / interval) ||
              Math.floor(z0 / interval) !== Math.floor(zDown / interval)
            ) {
              rgb = lerpColor(rgb, [226, 232, 240], 0.65);
              alpha = Math.max(alpha, 220);
            }
          }

          // Apply per-category visibility toggle and hover spotlighting
          if (hasHiddenBands && hiddenBandIndices.includes(cellBandIdx)) {
            alpha = 0;
          } else if (layerToRender === activeLayer && hoveredBandIdx !== null) {
            if (cellBandIdx === hoveredBandIdx) {
              alpha = Math.max(alpha, 250);
              shade = Math.min(1.35, shade * 1.15);
            } else {
              alpha = Math.min(alpha, 24);
            }
          }

          data[pIdx] = Math.min(255, Math.round(rgb[0] * shade));
          data[pIdx + 1] = Math.min(255, Math.round(rgb[1] * shade));
          data[pIdx + 2] = Math.min(255, Math.round(rgb[2] * shade));
          data[pIdx + 3] = alpha;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return offCanvas.toDataURL('image/png');
    },
    [
      activeLayer,
      fsiThreshold,
      isScenarioB,
      maskLowFsi,
      showHistoricalExtent,
      diffMatrixMode,
      showContours,
      simplifiedMode,
      showRasterLayer,
      hoveredBandIdx,
      hiddenBandIndices,
      slopeFlowOverlayMode,
      slopeMaxFilterPct,
      activeFloodWaveHour,
    ]
  );

  const generateRasterDataUrl = React.useCallback(
    () =>
      renderSimRasterToDataUrl(
        sim,
        peerSim,
        activeLayer,
        fsiThreshold,
        isScenarioB
      ),
    [renderSimRasterToDataUrl, sim, peerSim, activeLayer, fsiThreshold, isScenarioB]
  );

  const generatePeerSwipeRasterDataUrl = React.useCallback(
    () =>
      peerSim && swipeModeActive
        ? renderSimRasterToDataUrl(
            peerSim,
            sim,
            peerActiveLayer || activeLayer,
            resolvedPeerFsiThresh,
            true
          )
        : TRANSPARENT_PIXEL,
    [
      renderSimRasterToDataUrl,
      peerSim,
      sim,
      swipeModeActive,
      peerActiveLayer,
      activeLayer,
      resolvedPeerFsiThresh,
    ]
  );

  const generateRasterDataUrlRef = useRef(generateRasterDataUrl);
  useEffect(() => {
    generateRasterDataUrlRef.current = generateRasterDataUrl;
  }, [generateRasterDataUrl]);

  const clearHoverState = useCallback(() => {
    setCursorCoords((prev) => (prev === null ? null : null));
    const registry = syncRegistryRef?.current;
    if (registry?.hoverListeners) {
      Object.values(registry.hoverListeners).forEach((fn) => fn(null));
    }
    onSharedHoverCellChangeRef.current?.(null);
  }, [syncRegistryRef]);

  // Initialize Leaflet Map once on mount with dedicated Z-Ordered Panes
  useEffect(() => {
    let isMounted = true;
    let resizeObs: ResizeObserver | null = null;
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return;
      leafletRef.current = L;

      let initialCenter: [number, number] = [35.52, 36.335];
      let initialZoom = 10;
      if (syncRegistryRef?.current) {
        const existingPeer = Object.entries(syncRegistryRef.current.maps).find(
          ([key, inst]) => key !== mapId && inst !== null
        )?.[1];
        if (existingPeer) {
          const c = existingPeer.getCenter();
          initialCenter = [c.lat, c.lng];
          initialZoom = existingPeer.getZoom();
        }
      }

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 8,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: true,
      });

      // Create explicit Z-ordered panes so raster & vectors never occlude markers or swallow clicks
      const rasterPane = map.createPane('orontesRasterPane');
      rasterPane.style.zIndex = '250';
      rasterPane.style.pointerEvents = 'none';

      L.control.zoom({ position: 'topleft' }).addTo(map);
      L.control
        .scale({ position: 'bottomleft', metric: true, imperial: false })
        .addTo(map);

      if (syncRegistryRef?.current) {
        const registry = syncRegistryRef.current;
        registry.maps[mapId] = map;
        if (!registry.hoverListeners) {
          registry.hoverListeners = {};
        }

        const markAsDriver = () => {
          registry.activeDriverId = mapId;
        };

        const container = map.getContainer();
        container.addEventListener('pointerdown', markAsDriver, { passive: true });
        container.addEventListener('wheel', markAsDriver, { passive: true });
        container.addEventListener('touchstart', markAsDriver, { passive: true });
        map.on('mousedown', markAsDriver);
        map.on('dragstart', markAsDriver);
        map.on('zoomstart', () => {
          if (!registry.isSyncing && !registry.activeDriverId) {
            registry.activeDriverId = mapId;
          }
        });

        const syncPeerMaps = () => {
          if (registry.isSyncing) return;
          if (registry.activeDriverId && registry.activeDriverId !== mapId) return;
          registry.isSyncing = true;
          const center = map.getCenter();
          const zoom = map.getZoom();
          Object.entries(registry.maps).forEach(([peerId, peerMap]) => {
            if (peerId !== mapId && peerMap) {
              peerMap.setView(center, zoom, { animate: false });
            }
          });
          registry.isSyncing = false;
        };

        map.on('move', syncPeerMaps);
        map.on('zoom', syncPeerMaps);
      }

      const tileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Imagery &copy; Esri',
          maxZoom: 17,
        }
      ).addTo(map);
      tileLayerRef.current = tileLayer;

      const bounds: LType.LatLngBoundsExpression = [
        [BASIN_BOUNDS.minLat, BASIN_BOUNDS.minLon],
        [BASIN_BOUNDS.maxLat, BASIN_BOUNDS.maxLon],
      ];

      const initialUrl = generateRasterDataUrlRef.current();
      const rasterOverlay = L.imageOverlay(initialUrl, bounds, {
        pane: 'orontesRasterPane',
        opacity: 0.72,
        interactive: false,
        className: 'orontes-raster-overlay',
      }).addTo(map);
      rasterOverlayRef.current = rasterOverlay;

      const vGroup = L.layerGroup().addTo(map);
      vectorGroupRef.current = vGroup;

      const lmGroup = L.layerGroup().addTo(map);
      landmarksGroupRef.current = lmGroup;

      const drawGroup = L.layerGroup().addTo(map);
      customDrawGroupRef.current = drawGroup;

      const initLatLon = gridToLatLon(selectedCell.col, selectedCell.row);
      const reticle = L.circleMarker([initLatLon.lat, initLatLon.lon], {
        radius: 6,
        color: '#38bdf8',
        weight: 2,
        fillColor: '#0284c7',
        fillOpacity: 0.35,
        interactive: false,
      }).addTo(map);
      probeMarkerRef.current = reticle;

      const hoverReticle = L.circleMarker([initLatLon.lat, initLatLon.lon], {
        radius: 8,
        color: '#f59e0b',
        weight: 1.6,
        dashArray: '3 3',
        fillColor: '#38bdf8',
        fillOpacity: 0,
        opacity: 0,
        interactive: false,
      }).addTo(map);
      sharedHoverMarkerRef.current = hoverReticle;

      if (syncRegistryRef?.current) {
        if (!syncRegistryRef.current.hoverListeners) {
          syncRegistryRef.current.hoverListeners = {};
        }
        syncRegistryRef.current.hoverListeners[mapId] = (cell) => {
          setCursorCoords((prev) => {
            if (!cell && !prev) return null;
            if (cell && prev && prev.col === cell.col && prev.row === cell.row) {
              return prev;
            }
            return cell;
          });
          const hMarker = sharedHoverMarkerRef.current;
          if (!hMarker) return;
          if (!cell || gisToolModeRef.current !== 'inspect') {
            hMarker.setStyle({ opacity: 0, fillOpacity: 0 });
          } else {
            const { lat, lon } = gridToLatLon(cell.col, cell.row);
            hMarker.setLatLng([lat, lon]);
            hMarker.setStyle({ opacity: 0.95, fillOpacity: 0.18 });
          }
        };
      }

      let lastHoverCol = -1;
      let lastHoverRow = -1;

      map.on('mousemove', (e: LType.LeafletMouseEvent) => {
        if (simplifiedModeRef.current) return;
        const { lat, lng } = e.latlng;
        if (
          lat >= BASIN_BOUNDS.minLat &&
          lat <= BASIN_BOUNDS.maxLat &&
          lng >= BASIN_BOUNDS.minLon &&
          lng <= BASIN_BOUNDS.maxLon
        ) {
          const grid = latLonToGrid(lat, lng);
          if (grid.col === lastHoverCol && grid.row === lastHoverRow) return;
          lastHoverCol = grid.col;
          lastHoverRow = grid.row;
          const registry = syncRegistryRef?.current;
          if (registry?.hoverListeners) {
            Object.values(registry.hoverListeners).forEach((fn) => fn(grid));
          } else {
            setCursorCoords(grid);
          }
          onSharedHoverCellChangeRef.current?.(grid);
        } else if (lastHoverCol !== -1 || lastHoverRow !== -1) {
          lastHoverCol = -1;
          lastHoverRow = -1;
          const registry = syncRegistryRef?.current;
          if (registry?.hoverListeners) {
            Object.values(registry.hoverListeners).forEach((fn) => fn(null));
          } else {
            setCursorCoords(null);
          }
          onSharedHoverCellChangeRef.current?.(null);
        }
      });

      map.on('mouseout', () => {
        lastHoverCol = -1;
        lastHoverRow = -1;
        const registry = syncRegistryRef?.current;
        if (registry?.hoverListeners) {
          Object.values(registry.hoverListeners).forEach((fn) => fn(null));
        } else {
          setCursorCoords(null);
        }
        onSharedHoverCellChangeRef.current?.(null);
      });

      map.on('click', (e: LType.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        if (gisToolModeRef.current !== 'inspect') {
          setDrawnVertices((prev) => [
            ...prev,
            [Number(lat.toFixed(4)), Number(lng.toFixed(4))],
          ]);
          return;
        }
        if (
          lat >= BASIN_BOUNDS.minLat &&
          lat <= BASIN_BOUNDS.maxLat &&
          lng >= BASIN_BOUNDS.minLon &&
          lng <= BASIN_BOUNDS.maxLon
        ) {
          const grid = latLonToGrid(lat, lng);
          onSelectCellRef.current(grid.col, grid.row);
        }
      });

      requestAnimationFrame(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize({ pan: false });
        }
      });

      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObs = new ResizeObserver(() => {
          map.invalidateSize({ pan: false });
        });
        resizeObs.observe(mapContainerRef.current);
      }

      mapInstanceRef.current = map;
      setIsMapReady(true);
    });

    const currentRegistry = syncRegistryRef?.current;
    return () => {
      isMounted = false;
      if (resizeObs) {
        resizeObs.disconnect();
      }
      if (currentRegistry) {
        delete currentRegistry.maps[mapId];
        if (currentRegistry.hoverListeners) {
          delete currentRegistry.hoverListeners[mapId];
        }
        if (currentRegistry.activeDriverId === mapId) {
          currentRegistry.activeDriverId = null;
        }
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId]);

  // Recalculate Leaflet container dimensions when split-view or swipe state changes
  const hasScenarioHeader = Boolean(scenarioHeader);
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current) return;
    const timer = window.setTimeout(() => {
      mapInstanceRef.current?.invalidateSize({ pan: false });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [isMapReady, hasScenarioHeader, swipeModeActive]);

  // Global window pointer listeners for smooth Swipe Curtain dragging
  useEffect(() => {
    if (!isDraggingSwipe) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      if (!onSwipePercentChange || !mapContainerRef.current) return;
      const rect = mapContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
      onSwipePercentChange(Math.round(pct * 10) / 10);
    };

    const handlePointerUp = () => {
      setIsDraggingSwipe(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isDraggingSwipe, onSwipePercentChange]);

  // Switch Base Map Tile URL when baseMap state changes
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!isMapReady || !L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    let attribution = 'Imagery &copy; Esri';

    if (baseMap === 'shaded') {
      url =
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
      attribution = 'Terrain &amp; Hydrography &copy; Esri';
    } else if (baseMap === 'topo') {
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
      attribution = 'Map data: &copy; OpenStreetMap contributors, SRTM | OpenTopoMap';
    } else if (baseMap === 'dark') {
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
    } else if (baseMap === 'osm') {
      url = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
    }

    const newTile = L.tileLayer(url, { attribution, maxZoom: 17 }).addTo(map);
    newTile.bringToBack();
    tileLayerRef.current = newTile;
  }, [isMapReady, baseMap]);

  // Pixel-exact Swipe Curtain clipping across zoom, pan, and curtain drag
  const applySwipeClipPaths = useCallback(() => {
    const primaryEl = rasterOverlayRef.current?.getElement();
    const peerEl = swipeOverlayRef.current?.getElement();
    const containerEl = mapContainerRef.current;

    if (!swipeModeActive || !peerSim || !primaryEl || !containerEl) {
      if (primaryEl) primaryEl.style.clipPath = '';
      if (peerEl) peerEl.style.clipPath = '';
      return;
    }

    const containerRect = containerEl.getBoundingClientRect();
    const imgRect = primaryEl.getBoundingClientRect();
    if (imgRect.width <= 0 || containerRect.width <= 0) return;

    const splitScreenX = containerRect.left + (containerRect.width * swipePercent) / 100;
    const localSplitRatio = Math.max(
      0,
      Math.min(1, (splitScreenX - imgRect.left) / imgRect.width)
    );
    const leftClipPct = (localSplitRatio * 100).toFixed(2);
    const rightClipPct = ((1 - localSplitRatio) * 100).toFixed(2);

    // Scenario A (primary) shown on the RIGHT of the curtain; Scenario B (peer) shown on the LEFT
    primaryEl.style.clipPath = `inset(0% 0% 0% ${leftClipPct}%)`;
    if (peerEl) {
      peerEl.style.clipPath = `inset(0% ${rightClipPct}% 0% 0%)`;
    }
  }, [swipeModeActive, peerSim, swipePercent]);

  // Update Raster Image Overlay URL, Peer Swipe Overlay, and Opacity
  useEffect(() => {
    const overlay = rasterOverlayRef.current;
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!isMapReady || !overlay || !L || !map) return;

    const dataUrl = generateRasterDataUrl();
    if (dataUrl) {
      overlay.setUrl(dataUrl);
    }
    overlay.setOpacity(showRasterLayer ? rasterOpacity : 0);

    if (swipeModeActive && peerSim) {
      const peerUrl = generatePeerSwipeRasterDataUrl();
      const bounds: LType.LatLngBoundsExpression = [
        [BASIN_BOUNDS.minLat, BASIN_BOUNDS.minLon],
        [BASIN_BOUNDS.maxLat, BASIN_BOUNDS.maxLon],
      ];
      if (!swipeOverlayRef.current) {
        swipeOverlayRef.current = L.imageOverlay(peerUrl, bounds, {
          pane: 'orontesRasterPane',
          opacity: showRasterLayer ? rasterOpacity : 0,
          interactive: false,
          className: 'orontes-raster-overlay',
        }).addTo(map);
      } else {
        swipeOverlayRef.current.setUrl(peerUrl);
        swipeOverlayRef.current.setOpacity(showRasterLayer ? rasterOpacity : 0);
      }
    } else if (swipeOverlayRef.current) {
      swipeOverlayRef.current.remove();
      swipeOverlayRef.current = null;
    }

    applySwipeClipPaths();
  }, [
    isMapReady,
    generateRasterDataUrl,
    generatePeerSwipeRasterDataUrl,
    rasterOpacity,
    showRasterLayer,
    swipeModeActive,
    peerSim,
    applySwipeClipPaths,
  ]);

  // Re-synchronize Swipe Curtain clip boundary when zooming or panning
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!isMapReady || !map) return;
    applySwipeClipPaths();
    const onMoveOrZoom = () => applySwipeClipPaths();
    map.on('move', onMoveOrZoom);
    map.on('zoom', onMoveOrZoom);
    map.on('zoomend', onMoveOrZoom);
    map.on('moveend', onMoveOrZoom);
    return () => {
      map.off('move', onMoveOrZoom);
      map.off('zoom', onMoveOrZoom);
      map.off('zoomend', onMoveOrZoom);
      map.off('moveend', onMoveOrZoom);
    };
  }, [isMapReady, applySwipeClipPaths]);

  // Render Georeferenced Syrian Cities, Hydraulic Structures & Geomorphological Landmarks
  useEffect(() => {
    const L = leafletRef.current;
    const lmGroup = landmarksGroupRef.current;
    if (!isMapReady || !L || !lmGroup) return;

    lmGroup.clearLayers();
    if (!showLandmarks || simplifiedMode) return;

    ORONTES_BASIN_LANDMARKS.forEach((lm) => {
      const style =
        lm.category === 'city'
          ? {
              dot: '#f8fafc',
              ring: '#0ea5e9',
              bg: 'rgba(11, 14, 23, 0.92)',
              border: 'rgba(56, 189, 248, 0.65)',
              text: '#f0f9ff',
            }
          : lm.category === 'hydraulic'
          ? {
              dot: '#22d3ee',
              ring: '#0284c7',
              bg: 'rgba(8, 47, 73, 0.92)',
              border: 'rgba(34, 211, 238, 0.65)',
              text: '#cffafe',
            }
          : {
              dot: '#fcd34d',
              ring: '#d97706',
              bg: 'rgba(28, 25, 23, 0.88)',
              border: 'rgba(251, 191, 36, 0.5)',
              text: '#fef3c7',
            };

      const icon = L.divIcon({
        className: 'orontes-landmark-label',
        html: `<div dir="rtl" style="display:inline-flex;align-items:center;gap:4px;padding:1.5px 6px;border-radius:3px;background:${style.bg};border:1px solid ${style.border};box-shadow:0 2px 6px rgba(0,0,0,0.65);white-space:nowrap;">
          <span style="width:5px;height:5px;border-radius:9999px;background:${style.dot};box-shadow:0 0 0 1.5px ${style.ring};display:inline-block;"></span>
          <span style="font-size:9.5px;font-weight:700;color:${style.text};">${lm.nameAr}</span>
          <span style="font-size:8px;font-family:monospace;color:#94a3b8;">${lm.elevationM}م</span>
        </div>`,
        iconSize: [104, 20],
        iconAnchor: [52, 10],
      });

      const marker = L.marker([lm.lat, lm.lon], {
        icon,
        zIndexOffset: lm.category === 'city' ? 320 : 220,
      });

      marker.bindTooltip(
        `<div dir="rtl" style="font-family:sans-serif;font-size:11px;line-height:1.45;text-align:right;min-width:170px;">
          <div style="font-weight:700;color:#38bdf8;">${lm.nameAr}</div>
          <div style="color:#cbd5e1;font-size:10px;">${lm.subtitleAr}</div>
          <div style="color:#94a3b8;font-family:monospace;font-size:9.5px;margin-top:2px;">المنسوب الطبوغرافي: ${lm.elevationM} م فوق سطح البحر</div>
        </div>`,
        {
          direction: 'top',
          offset: [0, -8],
          opacity: 0.98,
        }
      );

      marker.addTo(lmGroup);
    });
  }, [isMapReady, showLandmarks, simplifiedMode]);

  // Update Synchronized Crosshair Reticle when external sharedHoverCell prop changes
  useEffect(() => {
    const hoverReticle = sharedHoverMarkerRef.current;
    if (!isMapReady || !hoverReticle) return;

    const activeHover = cursorCoords || sharedHoverCell;
    if (!activeHover || gisToolMode !== 'inspect') {
      hoverReticle.setStyle({ opacity: 0, fillOpacity: 0 });
      return;
    }

    const { lat, lon } = gridToLatLon(activeHover.col, activeHover.row);
    hoverReticle.setLatLng([lat, lon]);
    hoverReticle.setStyle({ opacity: 0.95, fillOpacity: 0.18 });
  }, [isMapReady, cursorCoords, sharedHoverCell, gisToolMode]);

  // Update Probe Reticle (hidden during measurement mode so it doesn't add stray SVG circles)
  useEffect(() => {
    const reticle = probeMarkerRef.current;
    const map = mapInstanceRef.current;
    if (!isMapReady || !reticle || !map) return;

    if (gisToolMode !== 'inspect') {
      reticle.setStyle({ opacity: 0, fillOpacity: 0 });
      return;
    }

    reticle.setStyle({ opacity: 1, fillOpacity: 0.35 });
    const { lat, lon } = gridToLatLon(selectedCell.col, selectedCell.row);
    reticle.setLatLng([lat, lon]);

    const paddedBounds = map.getBounds().pad(-0.15);
    if (!paddedBounds.contains([lat, lon])) {
      if (syncRegistryRef?.current) {
        syncRegistryRef.current.activeDriverId = mapId;
      }
      map.panTo([lat, lon], { animate: !simplifiedMode });
    }
  }, [isMapReady, selectedCell, simplifiedMode, gisToolMode, mapId, syncRegistryRef]);

  // Render Interactive Custom Polygon ROI / Distance Measurement Layer
  // Clicking an existing vertex removes it; no extra SVG shapes are drawn when drawnVertices is empty
  useEffect(() => {
    const L = leafletRef.current;
    const drawGroup = customDrawGroupRef.current;
    if (!isMapReady || !L || !drawGroup) return;

    drawGroup.clearLayers();
    if (drawnVertices.length === 0) return;

    if (gisToolMode === 'measure-area' && drawnVertices.length >= 3) {
      L.polygon(drawnVertices, {
        color: '#38bdf8',
        weight: 2.2,
        dashArray: '5 3',
        fillColor: '#38bdf8',
        fillOpacity: 0.22,
        interactive: false,
      }).addTo(drawGroup);
    } else if (drawnVertices.length >= 2) {
      L.polyline(drawnVertices, {
        color: '#38bdf8',
        weight: 2.2,
        dashArray: '5 3',
        interactive: false,
      }).addTo(drawGroup);
    }

    drawnVertices.forEach((pt, idx) => {
      const vMarker = L.circleMarker(pt, {
        radius: 5.5,
        color: '#090d16',
        weight: 1.5,
        fillColor: idx === 0 ? '#f59e0b' : '#38bdf8',
        fillOpacity: 1,
        interactive: true,
      });

      vMarker.bindTooltip(
        `<div dir="rtl" style="font-family: var(--font-sans), sans-serif; font-size: 10.5px; text-align: right;">
          النقطة #${idx + 1}: ${pt[0].toFixed(4)}° شمالاً، ${pt[1].toFixed(4)}° شرقاً<br/>
          <span style="color: #fb7185;">انقر على النقطة لحذفها</span>
        </div>`,
        { direction: 'top' }
      );

      vMarker.on('click', (e: LType.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        setDrawnVertices((prev) => prev.filter((_, i) => i !== idx));
      });

      vMarker.addTo(drawGroup);
    });
  }, [isMapReady, drawnVertices, gisToolMode]);

  // Render Vector Layers into the shared SVG overlayPane
  // Strictly respects layer toggles and stops event propagation on every interactive feature
  useEffect(() => {
    const L = leafletRef.current;
    const vGroup = vectorGroupRef.current;
    if (!isMapReady || !L || !vGroup) return;

    vGroup.clearLayers();

    // Optional Basin Graticule & Bounding Box (Only rendered when user toggles 'Grid' ON)
    if (showGraticule) {
      L.rectangle(
        [
          [BASIN_BOUNDS.minLat, BASIN_BOUNDS.minLon],
          [BASIN_BOUNDS.maxLat, BASIN_BOUNDS.maxLon],
        ],
        {
          color: '#475569',
          weight: 1,
          fill: false,
          dashArray: '4 4',
          interactive: false,
        }
      ).addTo(vGroup);

      [35.35, 35.5, 35.65].forEach((latTick) => {
        L.polyline(
          [
            [latTick, BASIN_BOUNDS.minLon],
            [latTick, BASIN_BOUNDS.maxLon],
          ],
          {
            color: '#334155',
            weight: 0.8,
            opacity: 0.65,
            dashArray: '2 4',
            interactive: false,
          }
        ).addTo(vGroup);
      });

      [36.25, 36.335, 36.42].forEach((lonTick) => {
        L.polyline(
          [
            [BASIN_BOUNDS.minLat, lonTick],
            [BASIN_BOUNDS.maxLat, lonTick],
          ],
          {
            color: '#334155',
            weight: 0.8,
            opacity: 0.65,
            dashArray: '2 4',
            interactive: false,
          }
        ).addTo(vGroup);
      });

      // W–E Cross-Section Reference Line (35.512°N)
      L.polyline(
        [
          [35.512, BASIN_BOUNDS.minLon],
          [35.512, BASIN_BOUNDS.maxLon],
        ],
        {
          color: '#38bdf8',
          weight: 1.4,
          dashArray: '6 4',
          interactive: false,
        }
      ).addTo(vGroup);
    }

    // 1. Historical Flood Extent Polygons — ONLY mounted in SVG DOM when showHistoricalExtent is true
    if (showHistoricalExtent) {
      const fillOp = diffMatrixMode ? 0.06 : 0.22;

      activeHistEvent.zones.forEach((zone) => {
        const breakdown = sim.historicalComparison.zoneBreakdown.find(
          (z) => z.zoneId === zone.zoneId
        );
        const overlapPct = breakdown ? breakdown.modeledOverlapPct : 0;

        const histPoly = L.polygon(zone.latLonPolygon, {
          className: 'orontes-hist-poly',
          color: '#f59e0b',
          weight: 2,
          dashArray: '6 4',
          opacity: 1,
          fillColor: '#38bdf8',
          fillOpacity: fillOp,
          interactive: gisToolMode === 'inspect',
        });

        const histAr = HISTORICAL_EVENT_ARABIC_DATA[activeHistEvent.id];
        const zoneAr = histAr?.zonesAr[zone.zoneId];

        histPoly.bindTooltip(
          `<div dir="rtl" style="font-family: var(--font-sans), sans-serif; font-size: 11px; text-align: right; line-height: 1.5;">
            <strong style="color: #fbbf24;">رصد الفيضان التاريخي (${activeHistEvent.year} SAR)</strong><br/>
            <strong>${zoneAr ? zoneAr.nameAr : zone.zoneName}</strong><br/>
            المساحة الجيوديسية: <strong>${zone.observedAreaHa.toLocaleString()} هكتار (${(
            zone.observedAreaHa / 100
          ).toFixed(1)} كم²)</strong><br/>
            أقصى عمق مرصود: ${zone.observedMaxDepthM.toFixed(2)} م · تطابق النموذج: <strong>${overlapPct}%</strong>
          </div>`,
          { sticky: !simplifiedMode, direction: 'top' }
        );

        histPoly.on('click', (e: LType.LeafletMouseEvent) => {
          if (gisToolModeRef.current !== 'inspect') return;
          L.DomEvent.stopPropagation(e);
          const grid = latLonToGrid(e.latlng.lat, e.latlng.lng);
          onSelectCellRef.current(grid.col, grid.row);
        });

        histPoly.addTo(vGroup);
      });
    }

    // 2. Agricultural Cadastral Parcels (Geodesic Areas & Live Inundation)
    if (showParcels) {
      sim.parcelImpacts.forEach((parcel) => {
        const isSelected = parcel.id === selectedParcelId;
        const pAr = PARCEL_ARABIC_DATA[parcel.id];
        const strokeColor = isSelected
          ? '#38bdf8'
          : parcel.riskClass === 'Critical'
          ? '#fb7185'
          : parcel.riskClass === 'High'
          ? '#fbbf24'
          : '#34d399';

        const poly = L.polygon(parcel.latLonPolygon, {
          color: strokeColor,
          weight: isSelected ? 2.0 : 1.1,
          opacity: isSelected ? 0.95 : 0.65,
          fillColor: strokeColor,
          fillOpacity: isSelected ? 0.16 : 0.04,
          interactive: gisToolMode === 'inspect',
        });

        poly.bindTooltip(
          `<div dir="rtl" style="font-family: var(--font-sans), sans-serif; font-size: 11px; text-align: right; line-height: 1.5;">
            <strong>${pAr ? pAr.nameAr : parcel.name}</strong> (${pAr ? pAr.subDistrictAr : parcel.subDistrict})<br/>
            المحصول: ${pAr ? pAr.primaryCropAr : parcel.primaryCrop}<br/>
            المساحة الجيوديسية: <strong>${parcel.areaHa.toLocaleString()} هكتار (${(
            parcel.areaHa / 100
          ).toFixed(1)} كم²)</strong><br/>
            المساحة المغمورة: <strong>${parcel.inundatedHa.toLocaleString()} هكتار (${
            parcel.inundatedPct
          }%)</strong> · متوسط العمق: ${parcel.meanDepthM} م<br/>
            التصنيف الهيدرولوجي: <strong>${translateRiskClassAr(parcel.riskClass)}</strong>
          </div>`,
          { sticky: !simplifiedMode, direction: 'top' }
        );

        poly.on('click', (e: LType.LeafletMouseEvent) => {
          if (gisToolModeRef.current !== 'inspect') return;
          L.DomEvent.stopPropagation(e);
          onSelectParcelRef.current(parcel.id);
          const grid = latLonToGrid(parcel.latCenter, parcel.lonCenter);
          onSelectCellRef.current(grid.col, grid.row);
        });

        poly.addTo(vGroup);
      });
    }

    // 3. Hydrography: Western Wadis, Irrigation Canals, Orontes Main Stem
    if (showWaterways) {
      WESTERN_WADIS_LATLON.forEach((wadi) => {
        L.polyline(wadi.path, {
          color: '#38bdf8',
          weight: 1.5,
          opacity: 0.8,
          dashArray: '3 3',
          interactive: gisToolMode === 'inspect',
        })
          .bindTooltip(`${wadi.name} — رافد سيلي جبلي منحدر من جبل النصيرية`, {
            sticky: !simplifiedMode,
          })
          .addTo(vGroup);
      });

      L.polyline(EAST_CANAL_LATLON, {
        color: '#22d3ee',
        weight: 2,
        opacity: 0.9,
        dashArray: '6 3',
        interactive: gisToolMode === 'inspect',
      })
        .bindTooltip('قناة الري الرئيسية الشرقية لسهل الغاب (العشارنة – قرقور)', {
          sticky: !simplifiedMode,
        })
        .addTo(vGroup);

      L.polyline(WEST_CANAL_LATLON, {
        color: '#22d3ee',
        weight: 2,
        opacity: 0.9,
        dashArray: '6 3',
        interactive: gisToolMode === 'inspect',
      })
        .bindTooltip('قناة الاعتراض والمصرف الرئيسي الغربي (أقدام جبل النصيرية)', {
          sticky: !simplifiedMode,
        })
        .addTo(vGroup);

      L.polyline(ORONTES_MAIN_LATLON, {
        color: '#38bdf8',
        weight: 3.5,
        opacity: 0.98,
        interactive: gisToolMode === 'inspect',
      })
        .bindTooltip('المجرى الرئيسي لنهر العاصي (المصرف الرئيسي A) — Orontes River', {
          sticky: !simplifiedMode,
        })
        .addTo(vGroup);
    }

    // 4. Optional D8 Flow Direction Velocity Arrows Layer
    if (showFlowVectors) {
      const dCols = [0, 1, 1, 1, 0, -1, -1, -1];
      const dRows = [-1, -1, 0, 1, 1, 1, 0, -1];
      const angleDegs = [0, 45, 90, 135, 180, 225, 270, 315];
      const stepR = simplifiedMode ? 12 : 8;
      const stepC = simplifiedMode ? 10 : 7;

      for (let r = 6; r < sim.rows - 6; r += stepR) {
        for (let c = 6; c < sim.cols - 6; c += stepC) {
          const idx = r * sim.cols + c;
          const acc = sim.flowAcc[idx];
          if (acc < 6) continue;
          const dir = sim.d8Dir[idx];
          if (dir < 0 || dir > 7) continue;

          const { lat, lon } = gridToLatLon(c, r);
          const nr = Math.max(0, Math.min(sim.rows - 1, r + dRows[dir] * 3));
          const nc = Math.max(0, Math.min(sim.cols - 1, c + dCols[dir] * 3));
          const dest = gridToLatLon(nc, nr);

          const isHighFlow = acc >= 120;
          const vecColor = isHighFlow ? '#ffffff' : '#38bdf8';

          L.polyline(
            [
              [lat, lon],
              [dest.lat, dest.lon],
            ],
            {
              color: vecColor,
              weight: isHighFlow ? 2.0 : 1.2,
              opacity: isHighFlow ? 0.92 : 0.7,
              interactive: false,
            }
          ).addTo(vGroup);

          const arrowIcon = L.divIcon({
            className: 'orontes-flow-arrow',
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            html: `<div style="
              transform: rotate(${angleDegs[dir]}deg);
              color: ${vecColor};
              font-size: ${isHighFlow ? '10px' : '8px'};
              line-height: 10px;
              text-align: center;
              pointer-events: none;
            ">▲</div>`,
          });
          L.marker([dest.lat, dest.lon], {
            icon: arrowIcon,
            interactive: false,
          }).addTo(vGroup);
        }
      }
    }

    // 5. Rural Roads & Vulnerable Bridges / Box Culverts
    if (showCrossings) {
      RURAL_ROADS_LATLON.forEach((road) => {
        L.polyline(road.path, {
          color: '#cbd5e1',
          weight: 1.5,
          opacity: 0.75,
          interactive: false,
        }).addTo(vGroup);
      });

      sim.infrastructureImpacts.forEach((inf) => {
        const isSelected = inf.id === selectedCrossingId;
        const cAr = CROSSING_ARABIC_DATA[inf.id];
        const bg =
          inf.status === 'Overtopped'
            ? '#e11d48'
            : inf.status === 'Surcharged'
            ? '#d97706'
            : '#0f766e';
        const glyph =
          inf.status === 'Overtopped'
            ? '✖'
            : inf.status === 'Surcharged'
            ? '▲'
            : '●';

        const sharesCoordWithBreach =
          inf.id === 'inf-karkor-weir-br' || inf.id === 'inf-qalaat-siphon';

        const icon = L.divIcon({
          className: 'orontes-sar-badge',
          iconSize: isSelected ? [64, 20] : [18, 18],
          iconAnchor: isSelected
            ? sharesCoordWithBreach
              ? [32, 22]
              : [32, 10]
            : sharesCoordWithBreach
            ? [9, 18]
            : [9, 9],
          html: isSelected
            ? `<div style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 1px 5px;
                background: ${bg};
                color: #ffffff;
                border: 2px solid #38bdf8;
                font-family: 'IBM Plex Mono', monospace;
                font-size: 10px;
                font-weight: 700;
                white-space: nowrap;
                cursor: pointer;
              "><span>${glyph}</span><span>${inf.code}</span></div>`
            : `<div style="
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: ${bg};
                color: #ffffff;
                border: ${
                  inf.inHistoricalFloodFootprint && showHistoricalExtent
                    ? '1.5px solid #fbbf24'
                    : '1px solid #090d16'
                };
                font-family: 'IBM Plex Mono', monospace;
                font-size: 9px;
                font-weight: 700;
                line-height: 1;
                cursor: pointer;
              " title="${inf.code}: ${cAr ? cAr.nameAr : inf.name}">${glyph}</div>`,
        });

        const marker = L.marker([inf.lat, inf.lon], {
          icon,
          zIndexOffset: isSelected ? 500 : 100,
          interactive: gisToolMode === 'inspect',
        });
        marker.bindTooltip(
          `<div dir="rtl" style="font-family: var(--font-sans), sans-serif; font-size: 11px; text-align: right; line-height: 1.5;">
            <strong>${inf.code} · ${cAr ? cAr.nameAr : inf.name}</strong><br/>
            ${cAr ? cAr.structureTypeAr : inf.structureType} — ${cAr ? cAr.waterwayAr : inf.waterway}<br/>
            صبيب الذروة: <strong>${inf.peakDischargeM3s} م³/ث</strong> / السعة الفعالة: ${inf.effectiveCapacityM3s} م³/ث (${(
            inf.capacityRatio * 100
          ).toFixed(0)}%)<br/>
            الحالة الهيدروليكية: <strong>${translateCrossingStatusAr(inf.status)}</strong>
          </div>`,
          { direction: 'top' }
        );

        marker.on('click', (e: LType.LeafletMouseEvent) => {
          if (gisToolModeRef.current !== 'inspect') return;
          L.DomEvent.stopPropagation(e);
          onSelectCrossingRef.current(inf.id);
          onSelectCellRef.current(inf.col, inf.row);
        });

        marker.addTo(vGroup);
      });
    }

    // 6. Canal Breach / Weir Bottleneck Hotspots
    if (showBreachPoints) {
      CANAL_BREACH_HOTSPOTS.forEach((breach) => {
        const isActive = activeBreachIds.includes(breach.id);
        const bAr = BREACH_ARABIC_DATA[breach.id];

        const breachIcon = L.divIcon({
          className: 'orontes-sar-badge',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          html: `<div style="
            width: 12px;
            height: 12px;
            margin: 2px;
            transform: rotate(45deg);
            background: ${isActive ? '#f59e0b' : '#334155'};
            border: 1.5px solid #ffffff;
            box-shadow: ${isActive ? '0 0 6px rgba(245, 158, 11, 0.8)' : 'none'};
            cursor: pointer;
          " title="${bAr ? bAr.nameAr : breach.arabicName}"></div>`,
        });

        const bMarker = L.marker([breach.lat, breach.lon], {
          icon: breachIcon,
          interactive: gisToolMode === 'inspect',
        });
        bMarker.bindTooltip(
          `<div dir="rtl" style="font-family: var(--font-sans), sans-serif; font-size: 11px; text-align: right; line-height: 1.5; max-width: 280px;">
            <strong>${isActive ? '▲ انكسار سدة نشط' : '● سدة محتواة وآمنة'}: ${bAr ? bAr.nameAr : breach.arabicName}</strong><br/>
            <span style="color: #38bdf8;">${bAr ? bAr.canalNameAr : breach.canalName}</span><br/>
            ${bAr ? `<span style="color: #cbd5e1; font-size: 10px;">${bAr.mechanismAr}</span><br/>` : ''}
            نصف قطر الطفح: <strong>${breach.spillRadiusKm} كم</strong> · انقر ${
            isActive ? 'لاحتواء وإصلاح الانكسار' : 'لتفعيل محاكاة الانكسار'
          }
          </div>`,
          { direction: 'bottom' }
        );
        bMarker.on('click', (e: LType.LeafletMouseEvent) => {
          if (gisToolModeRef.current !== 'inspect') return;
          L.DomEvent.stopPropagation(e);
          onToggleBreachRef.current(breach.id);
          onSelectCellRef.current(breach.col, breach.row);
        });
        bMarker.addTo(vGroup);
      });
    }
  }, [
    isMapReady,
    sim,
    diffMatrixMode,
    activeHistEvent,
    activeBreachIds,
    selectedCrossingId,
    selectedParcelId,
    showHistoricalExtent,
    showWaterways,
    showParcels,
    showCrossings,
    showBreachPoints,
    showFlowVectors,
    showGraticule,
    gisToolMode,
    simplifiedMode,
  ]);

  const handleCrossFadeToFsiOnly = () => {
    setDiffMatrixMode(false);
    onSelectLayer('fsi');
    setRasterOpacity(0.76);
    onToggleHistoricalExtent(false);
  };

  const handleCrossFadeToBlend = () => {
    setDiffMatrixMode(false);
    onSelectLayer('fsi');
    setRasterOpacity(0.65);
    onToggleHistoricalExtent(true);
  };

  const handleZoomToBasin = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (syncRegistryRef?.current) {
      syncRegistryRef.current.activeDriverId = mapId;
    }
    map.fitBounds(
      [
        [BASIN_BOUNDS.minLat, BASIN_BOUNDS.minLon],
        [BASIN_BOUNDS.maxLat, BASIN_BOUNDS.maxLon],
      ],
      {
        padding: [16, 16],
        animate: !simplifiedMode,
      }
    );
  };

  const peerLayerSpec = useMemo(
    () =>
      RASTER_LAYER_SPECS.find((s) => s.id === (peerActiveLayer || activeLayer)) ||
      activeSpec,
    [peerActiveLayer, activeLayer, activeSpec]
  );

  // Standardized Scenario A vs Scenario B cell values for the footer status bar
  const statusDepthA = isScenarioB
    ? peerTelemetry?.inundationDepthM ?? telemetry.inundationDepthM
    : telemetry.inundationDepthM;
  const statusDepthB = isScenarioB
    ? telemetry.inundationDepthM
    : peerTelemetry?.inundationDepthM ?? telemetry.inundationDepthM;
  const statusDeltaDepth = statusDepthB - statusDepthA;

  const statusFsiA = isScenarioB
    ? peerTelemetry?.fsi ?? telemetry.fsi
    : telemetry.fsi;
  const statusFsiB = isScenarioB
    ? telemetry.fsi
    : peerTelemetry?.fsi ?? telemetry.fsi;
  const statusDeltaFsi = statusFsiB - statusFsiA;

  return (
    <div
      dir="rtl"
      className="relative flex flex-col w-full h-full bg-[#07090E] select-none overflow-hidden"
    >
      {/* Optional Split-View Scenario Header Bar */}
      {scenarioHeader && (
        <div
          onClick={scenarioHeader.onSelectEditor}
          className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b font-sans text-xs cursor-pointer shrink-0 transition-colors ${
            scenarioHeader.isActiveEditor
              ? scenarioHeader.id === 'A'
                ? 'bg-sky-950/40 border-sky-500/60'
                : 'bg-emerald-950/40 border-emerald-500/60'
              : 'bg-[#0B0E17] border-[#1E293B] hover:bg-[#111827]'
          }`}
          title="انقر لتحديد هذا السيناريو وتعديل معاملاته في اللوحة الجانبية"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                scenarioHeader.id === 'A' ? 'bg-sky-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`font-semibold whitespace-nowrap shrink-0 ${
                scenarioHeader.id === 'A' ? 'text-sky-400' : 'text-emerald-400'
              }`}
            >
              {scenarioHeader.badge}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-slate-200 truncate font-medium">
              {scenarioHeader.title}
            </span>
            {scenarioHeader.isActiveEditor && (
              <span className="px-1.5 py-0.2 text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40 shrink-0">
                قيد التعديل
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-[11px] tabular-nums shrink-0 font-mono">
            <span>
              الفيضان:{' '}
              <strong className="text-rose-400">
                {scenarioHeader.floodKm2.toFixed(1)} كم²
              </strong>
              {typeof scenarioHeader.deltaKm2 === 'number' && (
                <span
                  className={`mr-1 font-semibold ${
                    scenarioHeader.deltaKm2 <= 0
                      ? 'text-emerald-400'
                      : 'text-amber-300'
                  }`}
                >
                  ({scenarioHeader.deltaKm2 > 0 ? '+' : ''}
                  {scenarioHeader.deltaKm2.toFixed(1)} كم²)
                </span>
              )}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              المحاصيل:{' '}
              <strong className="text-amber-300">
                {scenarioHeader.croplandHa.toLocaleString()} هكتار
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>
              الجسور المغمورة:{' '}
              <strong className="text-rose-400">
                {scenarioHeader.overtoppedCount}/{sim.infrastructureImpacts.length}
              </strong>
            </span>
          </div>
        </div>
      )}

      {/* Clean, Non-Duplicated Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0B0E17] border-b border-[#1E293B] text-xs font-sans z-20 shrink-0">
        {/* Right: Active Layer Indicator + Interactive Map Tool (Inspect vs Custom Cross-Section A-B) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400">الطبقة المعروضة:</span>
            <strong className="text-sky-300 font-semibold">
              {activeSpec.shortName}
            </strong>
          </div>

          <span className="text-slate-700">|</span>

          {/* Simple 2-Mode Tool Switcher: Inspect vs Draw Cross-Section A-B */}
          <div className="flex items-center gap-1 bg-[#111827] p-0.5 border border-[#1E293B]">
            <button
              type="button"
              onClick={() => {
                setDrawnVertices([]);
                setHoveredProfileSampleIdx(null);
                setGisToolMode('inspect');
              }}
              className={`px-2 py-0.5 text-[10.5px] inline-flex items-center gap-1 whitespace-nowrap ${
                gisToolMode === 'inspect'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MousePointer className="w-3 h-3" />
              فحص الخريطة
            </button>
            <button
              type="button"
              onClick={() => {
                if (gisToolMode !== 'profile-line') {
                  setDrawnVertices([]);
                  setHoveredProfileSampleIdx(null);
                  setGisToolMode('profile-line');
                } else {
                  setGisToolMode('inspect');
                }
              }}
              className={`px-2 py-0.5 text-[10.5px] inline-flex items-center gap-1 whitespace-nowrap ${
                gisToolMode === 'profile-line'
                  ? 'bg-emerald-400 text-slate-950 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Activity className="w-3 h-3" />
              رسم مقطع تضاريسي (A-B)
            </button>
          </div>

          {activeFloodWaveHour !== null && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-950/80 border border-amber-400 text-[10.5px] text-amber-200 font-mono">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>الساعة T+{activeFloodWaveHour}h</span>
              {onResetFloodWaveHour && (
                <button
                  type="button"
                  onClick={onResetFloodWaveHour}
                  className="mr-1 px-1 bg-amber-500/20 hover:bg-amber-500/40 text-white text-[9.5px]"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* Left: Base Map + Opacity + Fit Basin */}
        <div className="flex items-center gap-2">
          <select
            aria-label="اختيار خريطة الأساس"
            value={baseMap}
            onChange={(e) => setBaseMap(e.target.value as BaseMapStyle)}
            className="px-2 py-0.5 text-[11px] bg-[#111827] text-slate-200 border border-[#1E293B] font-medium focus:outline-none focus:border-sky-400"
          >
            <option value="satellite">الأساس: أقمار صناعية</option>
            <option value="shaded">الأساس: تضاريس</option>
            <option value="dark">الأساس: داكن</option>
          </select>

          <div className="hidden sm:flex items-center gap-1" title="شفافية الطبقة">
            <span className="text-[10.5px] text-slate-400">الشفافية</span>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.05}
              value={rasterOpacity}
              onChange={(e) => setRasterOpacity(Number(e.target.value))}
              className="w-14 accent-sky-500 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleZoomToBasin}
            className="px-2 py-0.5 text-[11px] bg-[#111827] hover:bg-[#1E293B] text-sky-300 hover:text-white border border-[#1E293B] font-medium inline-flex items-center gap-1 whitespace-nowrap"
          >
            <Maximize2 className="w-3 h-3" />
            توسيط
          </button>
        </div>
      </div>

      {/* Main Georeferenced Leaflet Viewport */}
      <div className="relative flex-1 w-full min-h-[240px] overflow-hidden">
        <div
          ref={mapContainerRef}
          dir="ltr"
          className="absolute inset-0 z-10 cursor-crosshair"
        />

        {/* Interactive Swipe Curtain Slider Overlay (When Swipe Comparison Mode is Active) */}
        {swipeModeActive && peerSim && (
          <div
            dir="ltr"
            className="absolute inset-0 z-30 pointer-events-none overflow-hidden"
          >
            <div
              style={{ left: `${swipePercent}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-sky-400 via-white to-emerald-400 shadow-[0_0_14px_rgba(255,255,255,0.95)] -translate-x-1/2 pointer-events-auto cursor-ew-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setIsDraggingSwipe(true);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsDraggingSwipe(true);
              }}
            >
              {/* Scenario B Badge on the Left of the Curtain */}
              <div
                dir="rtl"
                className="absolute top-2.5 right-3 bg-[#0B0E17]/95 border border-emerald-500/60 text-emerald-300 px-2 py-0.5 text-[10px] font-sans font-semibold whitespace-nowrap shadow-lg"
              >
                ◀ السيناريو (ب): {peerLayerSpec.shortName}
              </div>
              {/* Scenario A Badge on the Right of the Curtain */}
              <div
                dir="rtl"
                className="absolute top-2.5 left-3 bg-[#0B0E17]/95 border border-sky-500/60 text-sky-300 px-2 py-0.5 text-[10px] font-sans font-semibold whitespace-nowrap shadow-lg"
              >
                السيناريو (أ): {activeSpec.shortName} ▶
              </div>

              {/* Center Draggable Handle */}
              <div
                title="اسحب الستارة يميناً ويساراً للمقارنة الفورية بين السيناريو (أ) والسيناريو (ب)"
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-12 rounded-full bg-[#0B0E17]/95 border-2 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.65)] flex flex-col items-center justify-center gap-0.5 text-sky-200 hover:scale-105 transition-transform"
              >
                <Columns2 className="w-3.5 h-3.5 text-sky-300" />
                <span className="text-[8px] font-mono text-slate-300">
                  {Math.round(swipePercent)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Custom Polygon ROI / Distance Planimeter / Custom Cross-Section Profiler Overlay */}
        {gisToolMode !== 'inspect' && (
          <div
            dir="rtl"
            className={`absolute top-2.5 left-12 z-20 bg-[#0B0E17]/95 border ${
              gisToolMode === 'profile-line'
                ? 'border-emerald-500/75 w-[385px]'
                : 'border-amber-500/70 w-[305px]'
            } text-slate-200 font-sans text-xs max-w-[calc(100%-60px)] p-3 space-y-2 pointer-events-auto shadow-xl`}
          >
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-1.5">
              <span
                className={`font-semibold ${
                  gisToolMode === 'profile-line' ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {gisToolMode === 'measure-area'
                  ? 'ممساح المضلعات الجيوديسي (Planimeter)'
                  : gisToolMode === 'profile-line'
                  ? 'محلل المقطع التضاريسي والهيدرولوجي الحر (A → B)'
                  : 'مسطرة قياس المسافات الجيوديسية'}
              </span>
              <div className="flex items-center gap-1">
                {drawnVertices.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setDrawnVertices((prev) => prev.slice(0, -1))}
                      className="px-1.5 py-0.5 text-[10px] bg-[#111827] hover:bg-[#1E293B] text-amber-300 border border-[#1E293B]"
                      title="التراجع عن آخر نقطة"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawnVertices([])}
                      className="px-1.5 py-0.5 text-[10px] bg-[#111827] hover:bg-[#1E293B] text-rose-300 border border-[#1E293B]"
                    >
                      مسح
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDrawnVertices([]);
                    setHoveredProfileSampleIdx(null);
                    setGisToolMode('inspect');
                  }}
                  className="px-1.5 py-0.5 text-[10px] bg-[#111827] hover:bg-[#1E293B] text-slate-300 border border-[#1E293B]"
                >
                  إنهاء
                </button>
              </div>
            </div>

            {gisToolMode === 'measure-area' ? (
              drawnVertices.length < 3 ? (
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  انقر على <strong>٣ نقاط أو أكثر</strong> على الخريطة لقياس المساحة الجيوديسية لأي قطاع وحساب المساحة المغمورة داخله ({drawnVertices.length}
                  /3 نقاط موضوعة).
                </div>
              ) : (
                customRoiStats && (
                  <div className="space-y-1 text-[10.5px] tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-slate-400">المساحة الجيوديسية الكلية</span>
                      <span className="text-white font-semibold font-mono">
                        {customRoiStats.geodesicAreaHa.toLocaleString()} هكتار (
                        {customRoiStats.geodesicAreaKm2} كم²)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">محيط المضلع</span>
                      <span className="text-slate-200 font-mono">
                        {customRoiStats.perimeterKm} كم ({customRoiStats.vertexCount} رؤوس)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">المساحة المغمورة بالفيضان</span>
                      <span className="text-rose-400 font-semibold font-mono">
                        {customRoiStats.inundatedAreaHa.toLocaleString()} هكتار (
                        {customRoiStats.inundatedPct}%)
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">متوسط / أقصى مؤشر FSI</span>
                      <span className="text-amber-300 font-semibold font-mono">
                        {customRoiStats.meanFsi.toFixed(2)} /{' '}
                        {customRoiStats.maxFsi.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">متوسط / أقصى عمق غمر</span>
                      <span className="text-sky-300 font-mono">
                        {customRoiStats.meanWaterDepthM} م /{' '}
                        {customRoiStats.maxWaterDepthM} م
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">متوسط الارتفاع ونسبة الطين</span>
                      <span className="text-slate-300 font-mono">
                        {customRoiStats.meanElevationM} م · {customRoiStats.meanClayPct}%
                      </span>
                    </div>
                  </div>
                )
              )
            ) : gisToolMode === 'profile-line' ? (
              drawnVertices.length < 2 ? (
                <div className="text-[11px] text-slate-300 leading-relaxed">
                  انقر على <strong>نقطتين (A → B) أو أكثر</strong> على الخريطة لرسم مقطع تضاريسي وهيدرولوجي يعرض منسوب الأرض (DEM)، سطح الماء، نسبة الانحدار (%)، والتراكم المائي ({drawnVertices.length}/2 نقطة).
                </div>
              ) : (
                customProfileAnalysis && (
                  <div className="space-y-2 text-[10px] tabular-nums">
                    <div className="grid grid-cols-3 gap-1.5 bg-[#07090E] p-1.5 border border-[#1E293B] font-mono">
                      <div>
                        <div className="text-[9px] text-slate-400 font-sans">طول المقطع / الغمر</div>
                        <div className="text-white font-semibold">
                          {customProfileAnalysis.totalLengthKm} كم ({customProfileAnalysis.inundatedLengthKm} كم مغمور)
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-sans">نطاق الارتفاع</div>
                        <div className="text-amber-300 font-semibold">
                          {customProfileAnalysis.minElevM}–{customProfileAnalysis.maxElevM} م
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] text-slate-400 font-sans">الانحدار / العمق</div>
                        <div className="text-emerald-300 font-semibold">
                          {customProfileAnalysis.meanSlopePct}% · {customProfileAnalysis.maxDepthM}م
                        </div>
                      </div>
                    </div>

                    {/* Interactive SVG Cross-Section Chart */}
                    <div dir="ltr" className="relative">
                      <svg
                        viewBox="0 0 340 105"
                        className="w-full h-[105px] bg-[#07090E] border border-[#1E293B] cursor-crosshair"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 340;
                          const frac = Math.max(0, Math.min(1, (relX - 28) / 298));
                          const sIdx = Math.round(
                            frac * (customProfileAnalysis.samples.length - 1)
                          );
                          setHoveredProfileSampleIdx(sIdx);
                          const smp = customProfileAnalysis.samples[sIdx];
                          if (smp) {
                            onSelectCell(smp.col, smp.row);
                          }
                        }}
                      >
                        {(() => {
                          const samples = customProfileAnalysis.samples;
                          const zMin = Math.max(0, customProfileAnalysis.minElevM - 8);
                          const zMax = Math.max(
                            zMin + 25,
                            customProfileAnalysis.maxElevM + 10
                          );
                          const xOf = (i: number) =>
                            28 + (i / Math.max(1, samples.length - 1)) * 298;
                          const yOfZ = (z: number) =>
                            10 + 78 - ((z - zMin) / Math.max(1, zMax - zMin)) * 78;
                          const yOfSlope = (sPct: number) =>
                            10 + 78 - Math.min(1, sPct / 45) * 78;

                          const terrainArea =
                            `M 28,88 L ` +
                            samples
                              .map((s, i) => `${xOf(i).toFixed(1)},${yOfZ(s.elevationM).toFixed(1)}`)
                              .join(' L ') +
                            ` L 326,88 Z`;

                          const waterStageLine =
                            `M ` +
                            samples
                              .map(
                                (s, i) =>
                                  `${xOf(i).toFixed(1)},${yOfZ(
                                    s.elevationM + s.waterDepthM * 4.5
                                  ).toFixed(1)}`
                              )
                              .join(' L ');

                          const slopeLine =
                            `M ` +
                            samples
                              .map(
                                (s, i) =>
                                  `${xOf(i).toFixed(1)},${yOfSlope(s.slopePct).toFixed(1)}`
                              )
                              .join(' L ');

                          const activeIdx =
                            hoveredProfileSampleIdx ?? Math.floor(samples.length / 2);
                          const activeSmp = samples[activeIdx] || samples[0];

                          return (
                            <>
                              <line x1={28} y1={88} x2={326} y2={88} stroke="#334155" />
                              <line x1={28} y1={10} x2={28} y2={88} stroke="#334155" />
                              <text x={25} y={16} textAnchor="end" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                                {Math.round(zMax)}m
                              </text>
                              <text x={25} y={87} textAnchor="end" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                                {Math.round(zMin)}m
                              </text>

                              {/* Terrain DEM Polygon */}
                              <path d={terrainArea} fill="rgba(71, 85, 105, 0.45)" />
                              {/* Water Stage Line (Exaggerated 4.5x for visibility on valley floor) */}
                              <path
                                d={waterStageLine}
                                fill="none"
                                stroke="#38bdf8"
                                strokeWidth="1.8"
                              />
                              {/* Terrain DEM Crest Line */}
                              <path
                                d={
                                  `M ` +
                                  samples
                                    .map(
                                      (s, i) =>
                                        `${xOf(i).toFixed(1)},${yOfZ(s.elevationM).toFixed(1)}`
                                    )
                                    .join(' L ')
                                }
                                fill="none"
                                stroke="#cbd5e1"
                                strokeWidth="1.5"
                              />
                              {/* Terrain Slope % Curve */}
                              <path
                                d={slopeLine}
                                fill="none"
                                stroke="#10b981"
                                strokeWidth="1.3"
                                strokeDasharray="3 2"
                              />

                              {/* Active Sample Crosshair */}
                              {activeSmp && (
                                <g>
                                  <line
                                    x1={xOf(activeIdx)}
                                    y1={10}
                                    x2={xOf(activeIdx)}
                                    y2={88}
                                    stroke="#f59e0b"
                                    strokeWidth="1"
                                    strokeDasharray="2 2"
                                  />
                                  <circle
                                    cx={xOf(activeIdx)}
                                    cy={yOfZ(activeSmp.elevationM)}
                                    r="3"
                                    fill="#38bdf8"
                                    stroke="#ffffff"
                                    strokeWidth="1"
                                  />
                                </g>
                              )}

                              <text x={28} y={100} fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                                A (0.0 km)
                              </text>
                              <text x={177} y={100} textAnchor="middle" fill="#6ee7b7" fontSize="7.5" fontFamily="monospace">
                                ━ DEM  ━ Water  ╌ Slope%
                              </text>
                              <text x={326} y={100} textAnchor="end" fill="#94a3b8" fontSize="7.5" fontFamily="monospace">
                                B ({customProfileAnalysis.totalLengthKm} km)
                              </text>
                            </>
                          );
                        })()}
                      </svg>
                    </div>

                    {/* Hovered Sample Point Readout */}
                    {(() => {
                      const samples = customProfileAnalysis.samples;
                      const smp =
                        samples[hoveredProfileSampleIdx ?? Math.floor(samples.length / 2)] ||
                        samples[0];
                      if (!smp) return null;
                      return (
                        <div className="flex items-center justify-between px-2 py-1 bg-[#111827] border border-[#1E293B] font-mono text-[9.5px]">
                          <span className="text-amber-300">
                            مسافة {smp.distanceKm} كم · منسوب {smp.elevationM}م
                          </span>
                          <span className="text-emerald-300">
                            انحدار {smp.slopePct}%
                          </span>
                          <span className="text-sky-300">
                            عمق {smp.waterDepthM}م · تراكم {smp.flowAcc}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )
              )
            ) : drawnVertices.length < 2 ? (
              <div className="text-[11px] text-slate-300 leading-relaxed">
                انقر على <strong>نقطتين أو أكثر</strong> على الخريطة لقياس المسافة الجيوديسية على طول القنوات أو الطرق ({drawnVertices.length}/2 نقطة).
              </div>
            ) : (
              <div className="space-y-1 text-[10.5px] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">المسافة الجيوديسية الإجمالية</span>
                  <span className="text-sky-300 font-semibold text-xs font-mono">
                    {customLineDistKm.toFixed(2)} كم (
                    {Math.round(customLineDistKm * 1000).toLocaleString()} م)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">عدد النقاط</span>
                  <span className="text-slate-200">
                    {drawnVertices.length} نقاط (انقر على أي نقطة لحذفها)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Single Unified Dynamic Legend & Cell Probe HUD */}
        {showHud && (
          <OrontesDynamicLegend
            key={scenarioHeader ? 'split-legend' : 'single-legend'}
            activeSpec={activeSpec}
            activeLayer={activeLayer}
            onSelectLayer={(layer) => {
              setDiffMatrixMode(false);
              onSelectLayer(layer);
            }}
            fsiThreshold={fsiThreshold}
            telemetry={telemetry}
            peerTelemetry={peerTelemetry}
            isScenarioB={isScenarioB}
            onMouseEnterLegend={clearHoverState}
            showHistoricalExtent={showHistoricalExtent}
            onToggleHistoricalExtent={onToggleHistoricalExtent}
            diffMatrixMode={diffMatrixMode}
            activeHistYear={activeHistEvent.year}
            sim={sim}
            peerSim={peerSim}
            maskLowFsi={maskLowFsi}
            onToggleMaskLowFsi={() => setMaskLowFsi((v) => !v)}
            showRasterLayer={showRasterLayer}
            onToggleRasterLayer={() => setShowRasterLayer((p) => !p)}
            hoveredBandIdx={hoveredBandIdx}
            onHoverBandIdx={setHoveredBandIdx}
            hiddenBandIndices={hiddenBandIndices}
            onToggleBandVisibility={handleToggleBandVisibility}
            onResetBandVisibility={handleResetBandVisibility}
            showWaterways={showWaterways}
            onToggleWaterways={() => setShowWaterways((p) => !p)}
            showParcels={showParcels}
            onToggleParcels={() => setShowParcels((p) => !p)}
            showCrossings={showCrossings}
            onToggleCrossings={() => setShowCrossings((p) => !p)}
            showBreachPoints={showBreachPoints}
            onToggleBreachPoints={() => setShowBreachPoints((p) => !p)}
            showFlowVectors={showFlowVectors}
            onToggleFlowVectors={() => setShowFlowVectors((p) => !p)}
            showContours={showContours}
            onToggleContours={() => setShowContours((p) => !p)}
            showGraticule={showGraticule}
            onToggleGraticule={() => setShowGraticule((p) => !p)}
            showLandmarks={showLandmarks}
            onToggleLandmarks={() => setShowLandmarks((p) => !p)}
            activeBreachCount={activeBreachIds.length}
            slopeFlowOverlayMode={slopeFlowOverlayMode}
            onToggleSlopeFlowOverlayMode={() => setSlopeFlowOverlayMode((p) => !p)}
            slopeMaxFilterPct={slopeMaxFilterPct}
            onSlopeMaxFilterPctChange={setSlopeMaxFilterPct}
            onSelectCell={onSelectCell}
            compactDefault={Boolean(scenarioHeader)}
          />
        )}
      </div>

      {/* Dedicated Docked Bottom GIS Coordinate & Scenario A vs B Status Bar (Never overlaps map or legend) */}
      <div
        dir="rtl"
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2.5 py-1 bg-[#0B0E17] border-t border-[#1E293B] text-[10px] font-mono text-slate-300 z-20 shrink-0"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sky-400 font-semibold">
            {telemetry.lat.toFixed(4)}°N, {telemetry.lon.toFixed(4)}°E
          </span>
          <span className="text-slate-600">|</span>
          <span>
            خلية [{telemetry.row},{telemetry.col}]
          </span>
          <span className="text-slate-600">|</span>
          <span>المنسوب: {telemetry.conditionedElevationM.toFixed(1)} م</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-300 font-semibold">
            الانحدار: {telemetry.slopePct.toFixed(2)}% ({telemetry.slopeDeg.toFixed(1)}°) · التراكم: {telemetry.flowAccumulationCells.toLocaleString()} خلية
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-white font-semibold">
            FSI: {telemetry.fsi.toFixed(2)} · العمق: {telemetry.inundationDepthM.toFixed(2)} م
          </span>
        </div>

        {peerTelemetry && (
          <div className="flex items-center gap-2 flex-wrap text-[9.5px]">
            <span className="text-sky-300 font-semibold">
              أ: {statusDepthA.toFixed(2)} م (FSI {statusFsiA.toFixed(2)})
            </span>
            <span className="text-slate-500"> مقابل </span>
            <span className="text-emerald-300 font-semibold">
              ب: {statusDepthB.toFixed(2)} م (FSI {statusFsiB.toFixed(2)})
            </span>
            <span className="text-slate-600">|</span>
            <span
              className={`px-1.5 py-0.2 font-bold ${
                statusDeltaDepth > 0.04
                  ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
                  : statusDeltaDepth < -0.04
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-900 text-slate-300'
              }`}
            >
              Δ العمق (ب−أ): {statusDeltaDepth >= 0 ? '+' : ''}
              {statusDeltaDepth.toFixed(2)} م
            </span>
            <span className="text-amber-300">
              (ΔFSI: {statusDeltaFsi >= 0 ? '+' : ''}
              {statusDeltaFsi.toFixed(2)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

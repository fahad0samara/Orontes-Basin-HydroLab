'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useTransition,
} from 'react';
import {
  STORM_PRESETS,
  CANAL_BREACH_HOTSPOTS,
  HISTORICAL_FLOOD_EVENTS,
  DEFAULT_GFS_48H_FORECAST,
  fetchOrontesGfs48hForecast,
  Gfs48hForecastPayload,
  HydroModelParams,
  RasterLayerType,
  runOrontesHydroSimulation,
  InfrastructureImpact,
  AgriculturalParcelImpact,
  latLonToGrid,
} from '@/lib/orontes-hydro-engine';
import {
  HYDRO_SCIENTIFIC_DEFINITIONS,
  SCIENTIFIC_CATEGORY_LABELS,
  ScientificCategory,
  PARCEL_ARABIC_DATA,
  CROSSING_ARABIC_DATA,
  BREACH_ARABIC_DATA,
  HISTORICAL_EVENT_ARABIC_DATA,
  STORM_PRESET_ARABIC_DATA,
  LAYER_ARABIC_DEFINITIONS,
  translateRiskClassAr,
  translateCrossingStatusAr,
  translateWaterQualityStatusAr,
  translateErosionHazardAr,
  translateLandformAr,
  translateRecurrenceStatusAr,
} from '@/lib/orontes-arabic-i18n';
import OrontesGisMap, {
  MapSyncRegistry,
  RASTER_LAYER_SPECS,
} from '@/components/OrontesGisMap';
import FlowAccumulationHeatmap from '@/components/FlowAccumulationHeatmap';
import { useLowPowerDevice } from '@/hooks/use-mobile';
import {
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Columns2,
  Download,
  Gauge,
  Map as MapIcon,
  RefreshCw,
  RotateCcw,
  Sliders,
  Table as TableIcon,
  Clock,
  Play,
  Pause,
} from 'lucide-react';

const GFS_STATION_NAMES_AR: Record<string, { nameAr: string; sectorAr: string }> = {
  'gfs-shathah-crest': {
    nameAr: 'قمة جبل شطحة (السلسلة الساحلية الغربية)',
    sectorAr: 'الجرف الغربي لجبل النصيرية (1080 م)',
  },
  'gfs-karkor-gorge': {
    nameAr: 'مضيق وسد قرقور (المخرج الشمالي للحوض)',
    sectorAr: 'عنق الزجاجة الشمالي (169 م)',
  },
  'gfs-ziyarah-plain': {
    nameAr: 'سهل الزيارة الزراعي الأوسط',
    sectorAr: 'القطاع الأوسط لسهل الغاب (173 م)',
  },
  'gfs-qalaat-mudiq': {
    nameAr: 'قلعة المضيق وأفاميا (السهل الشرقي)',
    sectorAr: 'الضفة الشرقية لنهر العاصي (179 م)',
  },
  'gfs-suqaylabiyah-asharne': {
    nameAr: 'السقيلبية وسدة العشارنة (المدخل الجنوبي)',
    sectorAr: 'المدخل الجنوبي لسهل الغاب (192 م)',
  },
  'gfs-jabal-zawiya-east': {
    nameAr: 'هضبة جبل الزاوية الشرقية',
    sectorAr: 'المرتفعات الكلسية الشرقية (435 م)',
  },
};

const DEFAULT_PARAMS_A: HydroModelParams = {
  stormPresetId: 'jan-2024-cyclone',
  chirpsPeakMm: 142,
  orographicMultiplier: 1.45,
  fillSinksZLimit: 1.8,
  canalSiltationPct: 52,
  fsiThreshold: 0.65,
  weights: {
    twi: 32,
    chirps: 28,
    clay: 20,
    canalDist: 20,
  },
  activeBreachIds: [
    'breach-karkor-weir',
    'breach-qalaat-siphon',
    'breach-shathah-fan',
  ],
  selectedHistoricalEventId: 'hist-2024-jan',
};

const DEFAULT_PARAMS_B: HydroModelParams = {
  stormPresetId: 'jan-2024-cyclone',
  chirpsPeakMm: 142,
  orographicMultiplier: 1.45,
  fillSinksZLimit: 2.4,
  canalSiltationPct: 10,
  fsiThreshold: 0.65,
  weights: {
    twi: 32,
    chirps: 28,
    clay: 20,
    canalDist: 20,
  },
  activeBreachIds: [],
  selectedHistoricalEventId: 'hist-2024-jan',
};

type SidebarSectionFilter = 'all' | 'storm' | 'ahp' | 'breaches' | 'sar';

type BottomDockTab =
  | 'definitions'
  | 'culverts'
  | 'polders'
  | 'water-quality'
  | 'hydrograph'
  | 'historical-sar'
  | 'transect-we'
  | 'profile-sn';

type MobileViewMode = 'map' | 'controls' | 'tables';

export default function OrontesBasinHydroLabPage() {
  const isLowPowerDevice = useLowPowerDevice();
  const [manualLiteOverride, setManualLiteOverride] = useState<boolean | null>(
    null
  );
  const simplifiedMode =
    manualLiteOverride !== null ? manualLiteOverride : isLowPowerDevice;

  // Split-View Comparison State & Shared Leaflet Map Synchronization Registry
  const [isSplitView, setIsSplitView] = useState<boolean>(false);
  const [comparisonLayout, setComparisonLayout] = useState<'side-by-side' | 'swipe'>(
    'side-by-side'
  );
  const [swipePercent, setSwipePercent] = useState<number>(50);
  const [sharedBaseMap, setSharedBaseMap] = useState<
    'satellite' | 'shaded' | 'topo' | 'dark' | 'osm'
  >('satellite');
  const [sharedRasterOpacity, setSharedRasterOpacity] = useState<number>(0.72);
  const [sharedShowLandmarks, setSharedShowLandmarks] = useState<boolean>(true);
  const [lockSplitLayers, setLockSplitLayers] = useState<boolean>(true);
  const [activeLayerB, setActiveLayerB] = useState<RasterLayerType>('fsi');
  const [editingScenario, setEditingScenario] = useState<'A' | 'B'>('A');
  const mapSyncRegistryRef = useRef<MapSyncRegistry>({
    maps: {},
    isSyncing: false,
    activeDriverId: null,
    hoverListeners: {},
  });

  // Scenario A (Left / Primary) UI & Debounced Simulation State
  const [uiParamsA, setUiParamsA] = useState<HydroModelParams>(DEFAULT_PARAMS_A);
  const [simParamsA, setSimParamsA] = useState<HydroModelParams>(DEFAULT_PARAMS_A);

  // Scenario B (Right / Comparison) UI & Debounced Simulation State
  const [uiParamsB, setUiParamsB] = useState<HydroModelParams>(DEFAULT_PARAMS_B);
  const [simParamsB, setSimParamsB] = useState<HydroModelParams>(DEFAULT_PARAMS_B);

  const [isRecalcPending, startTransition] = useTransition();
  const isDebouncing = uiParamsA !== simParamsA || uiParamsB !== simParamsB;

  // Debounce Scenario A slider changes
  useEffect(() => {
    if (uiParamsA === simParamsA) return;
    const debounceMs = simplifiedMode ? 340 : 75;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        setSimParamsA(uiParamsA);
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [uiParamsA, simParamsA, simplifiedMode]);

  // Debounce Scenario B slider changes
  useEffect(() => {
    if (uiParamsB === simParamsB) return;
    const debounceMs = simplifiedMode ? 340 : 75;
    const timer = window.setTimeout(() => {
      startTransition(() => {
        setSimParamsB(uiParamsB);
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [uiParamsB, simParamsB, simplifiedMode]);

  const [activeLayer, setActiveLayer] = useState<RasterLayerType>('fsi');
  const [showHistoricalExtent, setShowHistoricalExtent] = useState<boolean>(false);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarSectionFilter>('storm');
  const [showAdvancedStormParams, setShowAdvancedStormParams] =
    useState<boolean>(false);
  const [bottomTab, setBottomTab] = useState<BottomDockTab>('polders');
  const [isBottomDockOpen, setIsBottomDockOpen] = useState<boolean>(false);
  const [mobileView, setMobileView] = useState<MobileViewMode>('map');

  // Scientific Definitions Encyclopedia State
  const [selectedDefCategory, setSelectedDefCategory] = useState<
    ScientificCategory | 'all'
  >('all');
  const [selectedDefId, setSelectedDefId] = useState<string>('fsi');

  const [selectedCell, setSelectedCell] = useState<{ col: number; row: number }>(
    () => latLonToGrid(35.505, 36.334)
  );
  const [selectedCrossingId, setSelectedCrossingId] = useState<string | null>(
    'inf-karkor-weir-br'
  );
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(
    'parcel-qalaat-floodplain'
  );
  const [transectHoverIdx, setTransectHoverIdx] = useState<number>(55);

  // 72-Hour Flood Wave Time-Slider State (null = Peak Envelope Mode, 0..72 = Dynamic Wave Propagation Hour)
  const [activeFloodWaveHour, setActiveFloodWaveHour] = useState<number | null>(
    null
  );
  const [isFloodWavePlaying, setIsFloodWavePlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isFloodWavePlaying) return;
    const timer = window.setInterval(() => {
      setActiveFloodWaveHour((prev) => {
        const current = prev === null ? 0 : prev;
        if (current >= 72) {
          return 2;
        }
        return current + 2;
      });
    }, 420);
    return () => window.clearInterval(timer);
  }, [isFloodWavePlaying]);

  // Short-Term (48-Hour) NOAA GFS Forecast State
  const [gfsForecast, setGfsForecast] = useState<Gfs48hForecastPayload>(
    DEFAULT_GFS_48H_FORECAST
  );
  const [liveGfsPayload, setLiveGfsPayload] =
    useState<Gfs48hForecastPayload | null>(null);
  const [isFetchingGfs, setIsFetchingGfs] = useState<boolean>(false);

  const handleFetchLiveGfs = useCallback(async (autoSwitchLayer = false) => {
    setIsFetchingGfs(true);
    try {
      const liveData = await fetchOrontesGfs48hForecast();
      setLiveGfsPayload(liveData);
      setGfsForecast(liveData);
      if (autoSwitchLayer) {
        setActiveLayer('gfs48h');
      }
    } finally {
      setIsFetchingGfs(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchOrontesGfs48hForecast().then((liveData) => {
      if (!active) return;
      setLiveGfsPayload(liveData);
      setGfsForecast(liveData);
    });
    return () => {
      active = false;
    };
  }, []);

  // Synchronize selected definition when active map layer changes
  const handleSelectLayerWithDef = useCallback((layer: RasterLayerType) => {
    setActiveLayer(layer);
    const matchingDef = HYDRO_SCIENTIFIC_DEFINITIONS.find((d) => d.id === layer);
    if (matchingDef) {
      setSelectedDefId(matchingDef.id);
    }
  }, []);

  // Run simulations for Scenario A and Scenario B with current 48h GFS raster
  const simA = useMemo(
    () => runOrontesHydroSimulation(simParamsA, gfsForecast),
    [simParamsA, gfsForecast]
  );
  const simB = useMemo(
    () => runOrontesHydroSimulation(simParamsB, gfsForecast),
    [simParamsB, gfsForecast]
  );

  // Active scenario currently inspected in the sidebar & bottom dock
  const activeTarget = isSplitView ? editingScenario : 'A';
  const uiParams = activeTarget === 'A' ? uiParamsA : uiParamsB;
  const simParams = activeTarget === 'A' ? simParamsA : simParamsB;
  const sim = activeTarget === 'A' ? simA : simB;

  const setActiveUiParams = useCallback(
    (updater: (prev: HydroModelParams) => HydroModelParams) => {
      if (activeTarget === 'A') {
        setUiParamsA(updater);
      } else {
        setUiParamsB(updater);
      }
    },
    [activeTarget]
  );

  const commitActiveParamsImmediately = useCallback(
    (next: HydroModelParams) => {
      if (activeTarget === 'A') {
        setUiParamsA(next);
        startTransition(() => {
          setSimParamsA(next);
        });
      } else {
        setUiParamsB(next);
        startTransition(() => {
          setSimParamsB(next);
        });
      }
    },
    [activeTarget]
  );

  const applyScenarioBPreset = (
    presetType: 'mitigation' | 'extreme-50yr' | 'moderate' | 'clone-a'
  ) => {
    setEditingScenario('B');
    if (presetType === 'mitigation') {
      const next: HydroModelParams = {
        ...uiParamsA,
        canalSiltationPct: 10,
        fillSinksZLimit: 2.4,
        activeBreachIds: [],
      };
      setUiParamsB(next);
      startTransition(() => setSimParamsB(next));
    } else if (presetType === 'extreme-50yr') {
      const next: HydroModelParams = {
        ...uiParamsA,
        stormPresetId: '100yr-extreme-design',
        chirpsPeakMm: 185,
        orographicMultiplier: 1.65,
        canalSiltationPct: 75,
        activeBreachIds: CANAL_BREACH_HOTSPOTS.map((b) => b.id),
      };
      setUiParamsB(next);
      startTransition(() => setSimParamsB(next));
    } else if (presetType === 'moderate') {
      const next: HydroModelParams = {
        ...uiParamsA,
        stormPresetId: 'mar-2022-spring-saturation',
        chirpsPeakMm: 68,
        orographicMultiplier: 1.2,
        canalSiltationPct: 25,
        activeBreachIds: [],
      };
      setUiParamsB(next);
      startTransition(() => setSimParamsB(next));
    } else {
      setUiParamsB(uiParamsA);
      startTransition(() => setSimParamsB(uiParamsA));
    }
  };

  const handleSwapScenarios = () => {
    const prevA = uiParamsA;
    const prevB = uiParamsB;
    setUiParamsA(prevB);
    setUiParamsB(prevA);
    startTransition(() => {
      setSimParamsA(prevB);
      setSimParamsB(prevA);
    });
  };

  const activeHistEvent =
    HISTORICAL_FLOOD_EVENTS.find(
      (e) => e.id === uiParams.selectedHistoricalEventId
    ) || HISTORICAL_FLOOD_EVENTS[0];

  const activeHistEventAr =
    HISTORICAL_EVENT_ARABIC_DATA[activeHistEvent.id] ||
    HISTORICAL_EVENT_ARABIC_DATA['hist-2024-jan'];

  const weightSum =
    uiParams.weights.twi +
      uiParams.weights.chirps +
      uiParams.weights.clay +
      uiParams.weights.canalDist || 1;

  const handleSelectCell = useCallback((col: number, row: number) => {
    setSelectedCell({ col, row });
  }, []);

  const handleSelectStormPreset = (presetId: string) => {
    const preset = STORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    commitActiveParamsImmediately({
      ...uiParams,
      stormPresetId: preset.id,
      chirpsPeakMm: preset.chirpsPeakMm,
      orographicMultiplier: preset.orographicFactor,
    });
  };

  const handleToggleBreachForScenario = useCallback(
    (target: 'A' | 'B', breachId: string) => {
      const toggleFn = (prev: HydroModelParams): HydroModelParams => {
        const exists = prev.activeBreachIds.includes(breachId);
        return {
          ...prev,
          activeBreachIds: exists
            ? prev.activeBreachIds.filter((id) => id !== breachId)
            : [...prev.activeBreachIds, breachId],
        };
      };

      if (target === 'A') {
        setUiParamsA(toggleFn);
        startTransition(() => {
          setSimParamsA(toggleFn);
        });
      } else {
        setUiParamsB(toggleFn);
        startTransition(() => {
          setSimParamsB(toggleFn);
        });
      }
    },
    []
  );

  const handleToggleHistoricalExtent = useCallback((forceState?: boolean) => {
    setShowHistoricalExtent((prev) =>
      typeof forceState === 'boolean' ? forceState : !prev
    );
  }, []);

  const handleSelectHistoricalEventId = useCallback((eventId: string) => {
    const updateEventFn = (prev: HydroModelParams): HydroModelParams => ({
      ...prev,
      selectedHistoricalEventId: eventId,
    });
    setUiParamsA(updateEventFn);
    setUiParamsB(updateEventFn);
    startTransition(() => {
      setSimParamsA(updateEventFn);
      setSimParamsB(updateEventFn);
    });
  }, []);

  const handleSelectCrossing = (crossing: InfrastructureImpact) => {
    setSelectedCrossingId(crossing.id);
    setSelectedCell({ col: crossing.col, row: crossing.row });
    setMobileView('map');
  };

  const handleSelectParcel = (parcel: AgriculturalParcelImpact) => {
    setSelectedParcelId(parcel.id);
    const grid = latLonToGrid(parcel.latCenter, parcel.lonCenter);
    setSelectedCell(grid);
    setMobileView('map');
  };

  const handleExportGisReport = () => {
    const headers = [
      'السيناريو',
      'نوع_العنصر',
      'الرمز_الهندسي',
      'الاسم_العربي',
      'خط_العرض_WGS84',
      'خط_الطول_WGS84',
      'المجرى_المائي_أو_الناحية',
      'مؤشر_الفيضان_FSI',
      'مؤشر_الرطوبة_TWI',
      'التصريف_الأقصى_أو_المساحة',
      'السعة_الفعالة_أو_المساحة_المغمورة',
      'الحالة_الهيدروليكية_ومستوى_الخطر',
    ];

    const buildRowsForSim = (label: string, s: typeof simA) => [
      ...s.infrastructureImpacts.map((c) => {
        const arCross = CROSSING_ARABIC_DATA[c.id];
        return [
          label,
          'جسر_أو_عبارة_مائية',
          c.code,
          `"${arCross?.nameAr || c.name}"`,
          c.lat,
          c.lon,
          `"${arCross?.waterwayAr || c.waterway}"`,
          c.localFsi,
          c.localTwi,
          `${c.peakDischargeM3s} م3/ث`,
          `${c.effectiveCapacityM3s} م3/ث`,
          `"${translateCrossingStatusAr(c.status)}"`,
        ];
      }),
      ...s.parcelImpacts.map((p) => {
        const arParcel = PARCEL_ARABIC_DATA[p.id];
        return [
          label,
          'حوض_زراعي',
          p.id,
          `"${arParcel?.nameAr || p.name}"`,
          p.latCenter,
          p.lonCenter,
          `"${arParcel?.subDistrictAr || p.subDistrict} (${arParcel?.primaryCropAr || p.primaryCrop})"`,
          p.meanFsi,
          p.meanTwi,
          `${p.areaHa} هكتار`,
          `${p.inundatedHa} هكتار (${p.inundatedPct}%) · رواسب TSS ${p.tssMgL} ملغ/ل (${p.sedimentYieldTonsDay} طن/يوم) · نترات NO3-N ${p.nitrateMgL} ملغ/ل`,
          `"${translateRiskClassAr(p.riskClass)} (${translateWaterQualityStatusAr(p.waterQualityStatus)})"`,
        ];
      }),
    ];

    const rowsA = buildRowsForSim('السيناريو_أ', simA);
    const rowsB = isSplitView ? buildRowsForSim('السيناريو_ب', simB) : [];

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...rowsA.map((r) => r.join(',')),
        ...rowsB.map((r) => r.join(',')),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orontes-al-ghab-arabic-gis-${
      isSplitView ? 'split-compare-A-vs-B' : simParams.stormPresetId
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute Scenario B vs Scenario A Delta Metrics & Mitigation Valuation
  const splitDelta = useMemo(() => {
    const deltaFloodKm2 = Number(
      (simB.summary.highRiskAreaKm2 - simA.summary.highRiskAreaKm2).toFixed(1)
    );
    const deltaCroplandHa =
      simB.summary.inundatedCroplandHa - simA.summary.inundatedCroplandHa;
    const deltaOvertopped =
      simB.summary.overtoppedCrossingsCount -
      simA.summary.overtoppedCrossingsCount;
    const deltaOutflowM3s = Number(
      (
        simB.summary.peakKarkorOutflowM3s - simA.summary.peakKarkorOutflowM3s
      ).toFixed(1)
    );
    const deltaSedimentTonsDay =
      simB.summary.totalSedimentTonsDay - simA.summary.totalSedimentTonsDay;
    const cropValueDeltaUsdK = Math.round((-deltaCroplandHa * 1450) / 1000);
    return {
      deltaFloodKm2,
      deltaCroplandHa,
      deltaOvertopped,
      deltaOutflowM3s,
      deltaSedimentTonsDay,
      cropValueDeltaUsdUsdK: cropValueDeltaUsdK,
    };
  }, [simA.summary, simB.summary]);

  const filteredScientificDefs = useMemo(() => {
    if (selectedDefCategory === 'all') return HYDRO_SCIENTIFIC_DEFINITIONS;
    return HYDRO_SCIENTIFIC_DEFINITIONS.filter(
      (d) => d.category === selectedDefCategory
    );
  }, [selectedDefCategory]);

  const activeScientificDef = useMemo(() => {
    return (
      HYDRO_SCIENTIFIC_DEFINITIONS.find((d) => d.id === selectedDefId) ||
      filteredScientificDefs[0] ||
      HYDRO_SCIENTIFIC_DEFINITIONS[0]
    );
  }, [selectedDefId, filteredScientificDefs]);

  const svgW = 860;
  const svgH = 185;
  const padL = 44;
  const padR = 24;
  const padT = 16;
  const padB = 24;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const sampledWestEast = useMemo(() => {
    const total = simA.westEastTransect.length;
    return simA.westEastTransect
      .map((pt, idx) => ({
        ptA: pt,
        ptB: simB.westEastTransect[idx] || pt,
        idx,
      }))
      .filter(
        ({ idx }) => !simplifiedMode || idx % 2 === 0 || idx === total - 1
      );
  }, [simA.westEastTransect, simB.westEastTransect, simplifiedMode]);

  const sampledSouthNorth = useMemo(() => {
    const total = simA.southNorthProfile.length;
    return simA.southNorthProfile
      .map((pt, idx) => ({
        ptA: pt,
        ptB: simB.southNorthProfile[idx] || pt,
        idx,
      }))
      .filter(
        ({ idx }) => !simplifiedMode || idx % 2 === 0 || idx === total - 1
      );
  }, [simA.southNorthProfile, simB.southNorthProfile, simplifiedMode]);

  const histTransectBounds = useMemo(() => {
    let first = -1;
    let last = -1;
    sim.westEastTransect.forEach((pt, idx) => {
      if (pt.inHistoricalExtent) {
        if (first === -1) first = idx;
        last = idx;
      }
    });
    if (first === -1) return null;
    const total = Math.max(1, sim.westEastTransect.length - 1);
    const x1 = padL + (first / total) * plotW;
    const x2 = padL + (last / total) * plotW;
    return { x: x1, width: Math.max(4, x2 - x1) };
  }, [sim.westEastTransect, padL, plotW]);

  const presetANameAr =
    STORM_PRESET_ARABIC_DATA[simParamsA.stormPresetId]?.nameAr ||
    STORM_PRESETS.find((p) => p.id === simParamsA.stormPresetId)?.name ||
    'السيناريو أ';
  const presetBNameAr =
    STORM_PRESET_ARABIC_DATA[simParamsB.stormPresetId]?.nameAr ||
    STORM_PRESETS.find((p) => p.id === simParamsB.stormPresetId)?.name ||
    'السيناريو ب';

  const activeStormPresetAr =
    STORM_PRESET_ARABIC_DATA[uiParams.stormPresetId] ||
    STORM_PRESET_ARABIC_DATA['jan-2024-cyclone'];

  return (
    <div
      dir="rtl"
      className={`h-screen overflow-hidden flex flex-col bg-[#07090E] text-slate-200 font-sans text-right ${
        simplifiedMode ? 'orontes-simplified-mode' : ''
      }`}
    >
      {/* Top Single-Row Arabic GIS Header: Title + 3 Core KPIs + Export */}
      <header className="h-12 px-4 bg-[#0B0E17] border-b border-[#1E293B] flex items-center justify-between gap-4 shrink-0">
        <a
          href="#top"
          className="text-xs md:text-sm font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          المرصد الهيدرولوجي لنهر العاصي — سهل الغاب
        </a>

        {/* 3 Core Live Summary Metrics */}
        <div className="hidden md:flex items-center gap-5 bg-[#07090E] px-3.5 py-1 border border-[#1E293B] font-mono tabular-nums text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-sans">نطاق الغمر الحرج:</span>
            <strong className="text-rose-400">{sim.summary.highRiskAreaKm2.toFixed(1)} كم²</strong>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-sans">الأراضي المغمورة:</span>
            <strong className="text-amber-300">{sim.summary.inundatedCroplandHa.toLocaleString()} هكتار</strong>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-sans">الجسور المتجاوزة:</span>
            <strong className="text-white">{sim.summary.overtoppedCrossingsCount}/10</strong>
          </div>
        </div>

        {/* Single Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportGisReport}
            className="px-3 py-1 text-xs font-mono font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير التقرير (CSV)
          </button>
        </div>
      </header>

      {/* Mobile / Tablet Responsive View Switcher (< lg screens) */}
      <div className="flex lg:hidden border-b border-[#1E293B] bg-[#0B0E17] text-xs font-sans shrink-0">
        <button
          type="button"
          onClick={() => setMobileView('map')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-l border-[#1E293B] whitespace-nowrap ${
            mobileView === 'map'
              ? 'bg-[#111827] text-sky-300 font-bold border-b-2 border-b-sky-400'
              : 'text-slate-400'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          الخريطة
        </button>
        <button
          type="button"
          onClick={() => setMobileView('controls')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 border-l border-[#1E293B] whitespace-nowrap ${
            mobileView === 'controls'
              ? 'bg-[#111827] text-sky-300 font-bold border-b-2 border-b-sky-400'
              : 'text-slate-400'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          التحكم
        </button>
        <button
          type="button"
          onClick={() => setMobileView('tables')}
          className={`flex-1 py-2 flex items-center justify-center gap-1.5 whitespace-nowrap ${
            mobileView === 'tables'
              ? 'bg-[#111827] text-sky-300 font-bold border-b-2 border-b-sky-400'
              : 'text-slate-400'
          }`}
        >
          <TableIcon className="w-3.5 h-3.5" />
          الرسوم والجداول
        </button>
      </div>

      {/* Main Workstation Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* RIGHT SIDEBAR: 3 Simple, Non-Duplicated Sections (Fits without scrolling) */}
        <aside
          className={`w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-[#0B0E17] lg:border-l border-[#1E293B] flex-col h-full overflow-y-auto divide-y divide-[#1E293B] ${
            mobileView === 'controls' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* SECTION 1: 4 Core Map Layers */}
          <div className="p-3.5 space-y-2.5">
            <h2 className="text-xs font-bold text-sky-400">
              ١. طبقة الخريطة
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'fsi', title: 'قابلية الفيضان (FSI)', sub: 'مؤشر الخطر' },
                  { id: 'slope', title: 'نسبة الانحدار (%)', sub: 'ميل التضاريس' },
                  { id: 'depth', title: 'عمق المياه (م)', sub: 'منسوب الغمر' },
                  { id: 'flowAcc', title: 'تراكم الجريان (D8)', sub: 'مسارات السيول' },
                ] as Array<{ id: RasterLayerType; title: string; sub: string }>
              ).map((ly) => {
                const isSel = activeLayer === ly.id;
                return (
                  <button
                    key={ly.id}
                    type="button"
                    onClick={() => handleSelectLayerWithDef(ly.id)}
                    className={`p-2 border text-right transition-colors ${
                      isSel
                        ? ly.id === 'slope'
                          ? 'bg-emerald-950/60 border-emerald-400 text-white'
                          : 'bg-sky-950/60 border-sky-400 text-white'
                        : 'bg-[#07090E] border-[#1E293B] text-slate-300 hover:bg-[#111827]'
                    }`}
                  >
                    <div className="font-bold text-[11px]">{ly.title}</div>
                    <div className="text-[9.5px] text-slate-400">{ly.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Storm Scenario & 2 Main Sliders */}
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-white">
                ٢. سيناريو العاصفة والأمطار
              </h2>
              <button
                type="button"
                onClick={() => commitActiveParamsImmediately(DEFAULT_PARAMS_A)}
                className="text-[10.5px] text-sky-400 hover:text-sky-300 inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                إعادة ضبط
              </button>
            </div>

            <select
              id="storm-preset-select"
              aria-label="الحدث المطري المرجعي"
              value={uiParams.stormPresetId}
              onChange={(e) => handleSelectStormPreset(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-[#111827] border border-[#1E293B] text-white focus:outline-none focus:border-sky-500"
            >
              {STORM_PRESETS.map((preset) => {
                const arPreset = STORM_PRESET_ARABIC_DATA[preset.id];
                return (
                  <option key={preset.id} value={preset.id}>
                    {arPreset?.nameAr || preset.name}
                  </option>
                );
              })}
            </select>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">كمية الأمطار (مم)</span>
                <span className="text-sky-300 font-mono font-bold">
                  {uiParams.chirpsPeakMm} مم
                </span>
              </div>
              <input
                type="range"
                min={45}
                max={220}
                step={5}
                value={uiParams.chirpsPeakMm}
                onChange={(e) =>
                  setActiveUiParams((p) => ({
                    ...p,
                    chirpsPeakMm: Number(e.target.value),
                  }))
                }
                className="w-full accent-sky-500 cursor-pointer h-1.5 bg-slate-800"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">انسداد المصارف (%)</span>
                <span className="text-amber-300 font-mono font-bold">
                  {uiParams.canalSiltationPct}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={85}
                step={5}
                value={uiParams.canalSiltationPct}
                onChange={(e) =>
                  setActiveUiParams((p) => ({
                    ...p,
                    canalSiltationPct: Number(e.target.value),
                  }))
                }
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800"
              />
            </div>
          </div>

          {/* SECTION 3: 72-Hour Flood Wave Time-Slider & Sentinel-1 SAR Overlay */}
          <div className="p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ٣. حركة الموجة (0–72 ساعة)
              </h2>
              <div className="flex items-center gap-1 font-mono">
                <button
                  type="button"
                  onClick={() => {
                    if (activeFloodWaveHour === null) {
                      setActiveFloodWaveHour(4);
                      setIsFloodWavePlaying(true);
                    } else {
                      setIsFloodWavePlaying((p) => !p);
                    }
                  }}
                  className={`px-2 py-0.5 text-[10px] border inline-flex items-center gap-1 ${
                    isFloodWavePlaying
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                      : 'bg-[#111827] text-amber-300 border-amber-500/40 hover:bg-amber-950/40'
                  }`}
                >
                  {isFloodWavePlaying ? (
                    <>
                      <Pause className="w-2.5 h-2.5" />
                      إيقاف
                    </>
                  ) : (
                    <>
                      <Play className="w-2.5 h-2.5" />
                      تشغيل
                    </>
                  )}
                </button>
                {activeFloodWaveHour !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFloodWavePlaying(false);
                      setActiveFloodWaveHour(null);
                    }}
                    className="px-1.5 py-0.5 text-[10px] bg-[#07090E] text-slate-300 hover:text-white border border-[#1E293B]"
                  >
                    الذروة
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">0س</span>
              <input
                type="range"
                min={0}
                max={72}
                step={2}
                value={activeFloodWaveHour ?? 28}
                onChange={(e) => {
                  setIsFloodWavePlaying(false);
                  setActiveFloodWaveHour(Number(e.target.value));
                }}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800"
              />
              <span className="text-[10px] font-mono text-amber-300 font-bold shrink-0">
                {activeFloodWaveHour !== null ? `T+${activeFloodWaveHour}س` : 'الذروة'}
              </span>
            </div>

            <div className="pt-2 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => handleToggleHistoricalExtent()}
                className={`w-full py-2 px-3 text-xs border transition-colors flex items-center justify-between ${
                  showHistoricalExtent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-[#07090E] text-slate-300 border-[#1E293B] hover:bg-[#111827]'
                }`}
              >
                <span>مضلع فيضان رادار Sentinel-1 (٢٠١٩)</span>
                <span className="font-mono text-[10px]">
                  {showHistoricalExtent ? 'معروض ✓' : 'إظهار'}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* CENTER/LEFT STAGE: Map + Clean 3-Tab Bottom Dock */}
        <div
          className={`flex-1 flex flex-col min-w-0 min-h-0 h-full ${
            mobileView === 'controls' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Georeferenced Map Stage */}
          <div
            className={`flex-1 min-h-0 relative ${
              mobileView === 'tables' ? 'hidden lg:grid' : 'grid'
            } grid-cols-1`}
          >
            <div className="relative w-full h-full min-h-[280px] overflow-hidden">
              <OrontesGisMap
                mapId="map-scenario-a"
                syncRegistryRef={mapSyncRegistryRef}
                sim={simA}
                activeLayer={activeLayer}
                onSelectLayer={(layer) => handleSelectLayerWithDef(layer)}
                fsiThreshold={simParamsA.fsiThreshold}
                activeBreachIds={simParamsA.activeBreachIds}
                onToggleBreach={(bId) => handleToggleBreachForScenario('A', bId)}
                selectedCell={selectedCell}
                onSelectCell={handleSelectCell}
                selectedCrossingId={selectedCrossingId}
                onSelectCrossing={setSelectedCrossingId}
                selectedParcelId={selectedParcelId}
                onSelectParcel={setSelectedParcelId}
                showHistoricalExtent={showHistoricalExtent}
                onToggleHistoricalExtent={handleToggleHistoricalExtent}
                selectedHistoricalEventId={simParamsA.selectedHistoricalEventId}
                onSelectHistoricalEventId={handleSelectHistoricalEventId}
                simplifiedMode={simplifiedMode}
                baseMapProp={sharedBaseMap}
                onBaseMapChange={setSharedBaseMap}
                rasterOpacityProp={sharedRasterOpacity}
                onRasterOpacityChange={setSharedRasterOpacity}
                showLandmarksProp={sharedShowLandmarks}
                onShowLandmarksChange={setSharedShowLandmarks}
                activeFloodWaveHour={activeFloodWaveHour}
                onResetFloodWaveHour={() => {
                  setIsFloodWavePlaying(false);
                  setActiveFloodWaveHour(null);
                }}
              />
            </div>
          </div>

          {/* Bottom Dock: 3 Direct Tabs Only (No Sub-Tabs) */}
          <div
            className={`bg-[#0B0E17] border-t border-[#1E293B] flex flex-col shrink-0 ${
              mobileView === 'tables'
                ? 'flex-1 h-full'
                : mobileView === 'map'
                ? isBottomDockOpen
                  ? 'hidden lg:flex lg:h-[245px]'
                  : 'hidden lg:flex lg:h-[38px]'
                : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#07090E] border-b border-[#1E293B] text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'polders' as const, label: '١. الأحواض الزراعية المتضررة' },
                    { id: 'hydrograph' as const, label: '٢. المنحنى المائي (72 ساعة)' },
                    { id: 'transect-we' as const, label: '٣. المقطع التضاريسي (غرب–شرق)' },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setBottomTab(tab.id);
                      setIsBottomDockOpen(true);
                    }}
                    className={`px-3 py-1 text-[11px] border whitespace-nowrap transition-colors ${
                      bottomTab === tab.id && isBottomDockOpen
                        ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                        : 'bg-[#111827] text-slate-300 border-[#1E293B] hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsBottomDockOpen((v) => !v)}
                className="hidden lg:inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] text-slate-300 hover:text-white border border-[#1E293B] bg-[#111827]"
              >
                {isBottomDockOpen ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    طي اللوحة
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    عرض الرسوم والجداول
                  </>
                )}
              </button>
            </div>

            {/* Dock Content Body */}
            {(isBottomDockOpen || mobileView === 'tables') && (
              <div className="flex-1 overflow-auto">
                {/* TAB 0: FULL ARABIC SCIENTIFIC DEFINITIONS & GLOSSARY ENCYCLOPEDIA */}
                {bottomTab === 'definitions' && (
                  <div className="flex flex-col h-full">
                    {/* Category Filter Bar */}
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-amber-300 font-bold ml-1">
                          التصنيف العلمي:
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedDefCategory('all')}
                          className={`px-2 py-0.5 border text-[10.5px] ${
                            selectedDefCategory === 'all'
                              ? 'bg-sky-400 text-slate-950 border-sky-300 font-bold'
                              : 'bg-[#07090E] text-slate-300 border-[#1E293B] hover:text-white'
                          }`}
                        >
                          جميع المفاهيم ({HYDRO_SCIENTIFIC_DEFINITIONS.length})
                        </button>
                        {(
                          Object.keys(
                            SCIENTIFIC_CATEGORY_LABELS
                          ) as ScientificCategory[]
                        ).map((catKey) => (
                          <button
                            key={catKey}
                            type="button"
                            onClick={() => {
                              setSelectedDefCategory(catKey);
                              const firstInCat = HYDRO_SCIENTIFIC_DEFINITIONS.find(
                                (d) => d.category === catKey
                              );
                              if (firstInCat) setSelectedDefId(firstInCat.id);
                            }}
                            className={`px-2 py-0.5 border text-[10.5px] ${
                              selectedDefCategory === catKey
                                ? 'bg-sky-400 text-slate-950 border-sky-300 font-bold'
                                : 'bg-[#07090E] text-slate-300 border-[#1E293B] hover:text-white'
                            }`}
                          >
                            {SCIENTIFIC_CATEGORY_LABELS[catKey].labelAr}
                          </button>
                        ))}
                      </div>
                      <span className="text-[10.5px] text-slate-400 hidden xl:inline">
                        انقر على أي مصطلح أو طبقة لعرض المعادلة الفيزيائية والتعريف الهندسي الكامل وتصنيف الفئات
                      </span>
                    </div>

                    {/* Split View: Right Term List + Left Full Detailed Definition & Classification Matrix */}
                    <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#1E293B] overflow-hidden">
                      {/* List of Scientific Terms */}
                      <div className="w-full md:w-[320px] shrink-0 overflow-y-auto bg-[#07090E] divide-y divide-[#1E293B]">
                        {filteredScientificDefs.map((defItem) => {
                          const isSelected = defItem.id === activeScientificDef.id;
                          const isRasterLayer =
                            defItem.category === 'layers' &&
                            defItem.id in LAYER_ARABIC_DEFINITIONS;
                          return (
                            <button
                              key={defItem.id}
                              type="button"
                              onClick={() => {
                                setSelectedDefId(defItem.id);
                                if (isRasterLayer) {
                                  setActiveLayer(defItem.id as RasterLayerType);
                                }
                              }}
                              className={`w-full px-3 py-2 text-right flex items-center justify-between gap-2 transition-colors ${
                                isSelected
                                  ? 'bg-[#111827] text-white border-r-2 border-r-amber-400'
                                  : 'text-slate-300 hover:bg-[#0B0E17] hover:text-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {defItem.titleAr}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {defItem.shortDefinitionAr}
                                </div>
                              </div>
                              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#07090E] border border-[#1E293B] text-sky-300 shrink-0">
                                {defItem.symbol}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Detailed Scientific Card */}
                      <div className="flex-1 overflow-y-auto p-3.5 bg-[#0B0E17] space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#1E293B] pb-2">
                          <div>
                            <div className="text-[10.5px] text-amber-300 font-semibold">
                              {activeScientificDef.categoryLabelAr} · (
                              {activeScientificDef.titleEn})
                            </div>
                            <h3 className="text-sm font-bold text-white mt-0.5">
                              {activeScientificDef.titleAr}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                            <span className="px-2 py-0.5 bg-[#07090E] border border-[#1E293B] text-sky-300">
                              الرمز: {activeScientificDef.symbol}
                            </span>
                            <span className="px-2 py-0.5 bg-[#07090E] border border-[#1E293B] text-emerald-300 font-sans">
                              الوحدة: {activeScientificDef.unitAr}
                            </span>
                          </div>
                        </div>

                        {/* Mathematical Equation & Physical Definition */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                          <div className="xl:col-span-7 space-y-2">
                            <div className="p-2 bg-[#07090E] border border-[#1E293B] flex items-center justify-between gap-2">
                              <span className="text-[10.5px] text-slate-400 shrink-0">
                                المعادلة الرياضية المعتمدة:
                              </span>
                              <code
                                dir="ltr"
                                className="text-xs font-mono text-amber-300 font-semibold overflow-x-auto"
                              >
                                {activeScientificDef.equation}
                              </code>
                            </div>

                            <div className="text-xs text-slate-200 leading-relaxed space-y-1.5">
                              <div>
                                <strong className="text-sky-300">
                                  التعريف العلمي والفيزيائي الكامل:{' '}
                                </strong>
                                {activeScientificDef.fullDefinitionAr}
                              </div>
                              <div className="p-2 bg-[#111827]/70 border border-[#1E293B] text-[11px] text-slate-300">
                                <strong className="text-emerald-300">
                                  التطبيق الهيدرولوجي في حوض سهل الغاب:{' '}
                                </strong>
                                {activeScientificDef.alGhabContextAr}
                              </div>
                            </div>
                          </div>

                          {/* Ranges & Threshold Classification Table */}
                          <div className="xl:col-span-5">
                            <div className="text-[11px] font-bold text-slate-300 mb-1.5">
                              نطاقات القيم والتفسير الهيدروليكي المعياري:
                            </div>
                            <div className="border border-[#1E293B] bg-[#07090E] divide-y divide-[#1E293B] text-[11px]">
                              {activeScientificDef.rangesAr.map((rng, i) => (
                                <div
                                  key={i}
                                  className="p-2 flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="w-2.5 h-2.5 shrink-0 border border-white/20"
                                        style={{ backgroundColor: rng.color }}
                                      />
                                      <span className="font-bold text-white">
                                        {rng.labelAr}
                                      </span>
                                    </div>
                                    <p className="text-[10.5px] text-slate-400 mt-0.5 pr-4">
                                      {rng.meaningAr}
                                    </p>
                                  </div>
                                  <span
                                    dir="ltr"
                                    className="font-mono text-[10.5px] text-sky-300 bg-[#111827] px-1.5 py-0.5 border border-[#1E293B] whitespace-nowrap shrink-0"
                                  >
                                    {rng.range}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {bottomTab === 'culverts' && (
                  <div className="flex flex-col h-full">
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                      <span className="text-slate-300">
                        <strong className="text-sky-300">
                          التعريف الهيدروليكي للمنشآت المائية:
                        </strong>{' '}
                        يُقاس أداء الجسور والعبارات الصندوقية والسيفونات بنسبة التصريف الأقصى للفيضان (Qₚ) إلى السعة الفعالة للمنشأة بعد خصم نسبة انسداد الطمي (Q_eff).
                      </span>
                      <span className="font-mono text-[10.5px] text-amber-300">
                        سالك (&lt; 85%) · مضغوط حرج (85%–100%) · مغمور فوق الجسر (&gt; 100%)
                      </span>
                    </div>
                    <table className="w-full text-right border-collapse text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[#111827] text-[10.5px] text-slate-400 border-b border-[#1E293B]">
                        <tr>
                          <th className="py-1.5 px-3 font-medium">الرمز</th>
                          <th className="py-1.5 px-2 font-medium">اسم المنشأة ونوعها الهندسي</th>
                          <th className="py-1.5 px-2 font-medium">المجرى المائي والمحور الطرقي</th>
                          <th className="py-1.5 px-2 font-medium">التوصيف الهندسي وآلية الخطورة</th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            {isSplitView ? 'تصريف السيناريو أ' : 'التصريف / السعة الفعالة'}
                          </th>
                          <th className="py-1.5 px-3 text-left font-medium">
                            {isSplitView ? 'الحالة (أ ← ب)' : 'الحالة الهيدروليكية'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B] text-[11px]">
                        {simA.infrastructureImpacts.map((infA, idx) => {
                          const infB = simB.infrastructureImpacts[idx] || infA;
                          const activeInf = activeTarget === 'A' ? infA : infB;
                          const isSel = activeInf.id === selectedCrossingId;
                          const arCross = CROSSING_ARABIC_DATA[activeInf.id];
                          return (
                            <tr
                              key={activeInf.id}
                              onClick={() => handleSelectCrossing(activeInf)}
                              className={`cursor-pointer ${
                                isSel ? 'bg-sky-950/50 text-white' : 'hover:bg-[#111827]'
                              }`}
                            >
                              <td className="py-1.5 px-3 font-mono font-semibold text-sky-400 whitespace-nowrap">
                                {activeInf.code}
                              </td>
                              <td className="py-1.5 px-2">
                                <div className="font-semibold text-slate-100">
                                  {arCross?.nameAr || activeInf.name}
                                </div>
                                <div className="text-[10px] text-sky-300/80">
                                  {arCross?.structureTypeAr || activeInf.structureType}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-slate-300">
                                <div>{arCross?.waterwayAr || activeInf.waterway}</div>
                                <div className="text-[10px] text-slate-400">
                                  {arCross?.roadCorridorAr || activeInf.roadCorridor}
                                </div>
                              </td>
                              <td className="py-1.5 px-2 text-[10.5px] text-slate-400 max-w-[280px]">
                                {arCross?.engineeringDefAr}
                              </td>
                              {isSplitView ? (
                                <>
                                  <td className="py-1.5 px-2 text-left font-mono whitespace-nowrap">
                                    <span className="text-sky-300 font-semibold">
                                      {infA.peakDischargeM3s.toFixed(1)}
                                    </span>{' '}
                                    →{' '}
                                    <span className="text-emerald-300 font-semibold">
                                      {infB.peakDischargeM3s.toFixed(1)}
                                    </span>{' '}
                                    م³/ث
                                  </td>
                                  <td className="py-1.5 px-3 text-left font-semibold whitespace-nowrap">
                                    <span
                                      className={
                                        infA.status === 'Overtopped'
                                          ? 'text-rose-400'
                                          : infA.status === 'Surcharged'
                                          ? 'text-amber-400'
                                          : 'text-emerald-400'
                                      }
                                    >
                                      {translateCrossingStatusAr(infA.status)}
                                    </span>
                                    <span className="text-slate-500 mx-1">←</span>
                                    <span
                                      className={
                                        infB.status === 'Overtopped'
                                          ? 'text-rose-400'
                                          : infB.status === 'Surcharged'
                                          ? 'text-amber-400'
                                          : 'text-emerald-400'
                                      }
                                    >
                                      {translateCrossingStatusAr(infB.status)}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-1.5 px-2 text-left font-mono whitespace-nowrap">
                                    <span className="text-white font-semibold">
                                      {activeInf.peakDischargeM3s.toFixed(1)}
                                    </span>{' '}
                                    / {activeInf.effectiveCapacityM3s.toFixed(1)} م³/ث (
                                    {(activeInf.capacityRatio * 100).toFixed(0)}%)
                                  </td>
                                  <td
                                    className={`py-1.5 px-3 text-left font-semibold whitespace-nowrap ${
                                      activeInf.status === 'Overtopped'
                                        ? 'text-rose-400'
                                        : activeInf.status === 'Surcharged'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {activeInf.status === 'Overtopped'
                                      ? `✖ مغمور فيضانياً (+${activeInf.overtoppingDepthM}م)`
                                      : activeInf.status === 'Surcharged'
                                      ? '▲ مضغوط هيدروليكياً'
                                      : '● سالك وآمن'}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {bottomTab === 'polders' && (
                  <div className="flex flex-col h-full">
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                      <span className="text-slate-300">
                        <strong className="text-sky-300">
                          تعريف الأحواض الزراعية (Polders) والغدق الطيني:
                        </strong>{' '}
                        تقسيمات استصلاح سهل الغاب المحاطة بالمصارف؛ يؤدي ارتفاع نسبة طين الفيرتيسول (58%–68%) إلى حبس مياه الفيضان واختناق الجذور عند تجاوز الركود 48 ساعة.
                      </span>
                    </div>
                    <table className="w-full text-right border-collapse text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[#111827] text-[10.5px] text-slate-400 border-b border-[#1E293B]">
                        <tr>
                          <th className="py-1.5 px-3 font-medium">
                            القطاع / الحوض الزراعي والناحية
                          </th>
                          <th className="py-1.5 px-2 font-medium">المحاصيل الاستراتيجية</th>
                          <th className="py-1.5 px-2 font-medium">التعريف البيدولوجي والصرف</th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            المساحة الكلية
                          </th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            {isSplitView ? 'المساحة المغمورة (أ ← ب)' : 'المساحة المغمورة'}
                          </th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            {isSplitView ? 'صافي التغير (ب - أ)' : 'مدة الركود المائي'}
                          </th>
                          <th className="py-1.5 px-3 text-left font-medium">
                            مستوى الخطر
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B] text-[11px]">
                        {simA.parcelImpacts.map((pA, idx) => {
                          const pB = simB.parcelImpacts[idx] || pA;
                          const activeP = activeTarget === 'A' ? pA : pB;
                          const deltaHa = pB.inundatedHa - pA.inundatedHa;
                          const isSel = activeP.id === selectedParcelId;
                          const arParcel = PARCEL_ARABIC_DATA[activeP.id];
                          return (
                            <tr
                              key={activeP.id}
                              onClick={() => handleSelectParcel(activeP)}
                              className={`cursor-pointer ${
                                isSel ? 'bg-sky-950/50 text-white' : 'hover:bg-[#111827]'
                              }`}
                            >
                              <td className="py-2 px-3">
                                <div className="font-semibold text-white">
                                  {arParcel?.nameAr || activeP.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {arParcel?.subDistrictAr || activeP.subDistrict}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-slate-200">
                                {arParcel?.primaryCropAr || activeP.primaryCrop}
                              </td>
                              <td className="py-2 px-2 text-[10.5px] text-slate-400 max-w-[290px]">
                                <div>{arParcel?.agronomicDefAr}</div>
                              </td>
                              <td className="py-2 px-2 text-left font-mono text-slate-300 whitespace-nowrap">
                                {activeP.areaHa.toLocaleString()} هكتار
                              </td>
                              {isSplitView ? (
                                <>
                                  <td className="py-2 px-2 text-left font-mono whitespace-nowrap">
                                    <span className="text-sky-300 font-semibold">
                                      {pA.inundatedHa.toLocaleString()}
                                    </span>{' '}
                                    ←{' '}
                                    <span className="text-emerald-300 font-semibold">
                                      {pB.inundatedHa.toLocaleString()}
                                    </span>{' '}
                                    هـ
                                  </td>
                                  <td
                                    className={`py-2 px-2 text-left font-mono font-semibold whitespace-nowrap ${
                                      deltaHa <= 0
                                        ? 'text-emerald-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {deltaHa > 0 ? '+' : ''}
                                    {deltaHa.toLocaleString()} هكتار
                                  </td>
                                  <td className="py-2 px-3 text-left font-semibold whitespace-nowrap">
                                    {translateRiskClassAr(pB.riskClass)}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-2 px-2 text-left font-mono font-semibold text-amber-300 whitespace-nowrap">
                                    {activeP.inundatedHa.toLocaleString()} هكتار (
                                    {activeP.inundatedPct}%)
                                  </td>
                                  <td className="py-2 px-2 text-left font-mono text-slate-300 whitespace-nowrap">
                                    {activeP.stagnationHours} ساعة
                                  </td>
                                  <td
                                    className={`py-2 px-3 text-left font-semibold whitespace-nowrap ${
                                      activeP.riskClass === 'Critical'
                                        ? 'text-rose-400'
                                        : activeP.riskClass === 'High'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {translateRiskClassAr(activeP.riskClass)}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {bottomTab === 'water-quality' && (
                  <div className="flex flex-col h-full">
                    {/* Unboxed Telemetry Header Strip */}
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-sky-300 font-bold">
                          تقدير الحمل الرسوبي العالق (TSS) وغسيل النترات الزراعية (NO₃-N) ({activeTarget === 'A' ? 'السيناريو أ' : 'السيناريو ب'})
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="text-slate-400">
                          محسوب من تراكم الجريان D8 وإجهاد القص القاعي وغسيل أسمدة القمح والشمندر السكري
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">
                          الصادرات الرسوبية للحوض:{' '}
                          <strong className="text-amber-300">
                            {sim.summary.totalSedimentTonsDay.toLocaleString()} طن/يوم
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          عكارة مخرج قرقور TSS:{' '}
                          <strong className="text-amber-300">
                            {sim.summary.karkorExportTssMgL} ملغ/ل
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          متوسط النترات NO₃-N:{' '}
                          <strong
                            className={
                              sim.summary.meanBasinNitrateMgL >= 10
                                ? 'text-rose-400'
                                : 'text-sky-300'
                            }
                          >
                            {sim.summary.meanBasinNitrateMgL.toFixed(2)} ملغ/ل
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          تجاوز حد الفاو (10 ملغ/ل):{' '}
                          <strong
                            className={
                              sim.summary.impairedPoldersCount > 0
                                ? 'text-rose-400'
                                : 'text-emerald-400'
                            }
                          >
                            {sim.summary.impairedPoldersCount} / {sim.parcelImpacts.length} أحواض
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* Split Layout: Right Polder Table + Left 60km Dual-Metric Longitudinal Plume Chart */}
                    <div className="flex-1 min-h-0 flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x xl:divide-x-reverse divide-[#1E293B] overflow-auto">
                      {/* Agricultural Polder Sediment & Nitrate Table */}
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-right border-collapse text-xs tabular-nums">
                          <thead className="sticky top-0 bg-[#111827] text-[10.5px] text-slate-400 border-b border-[#1E293B]">
                            <tr>
                              <th className="py-1.5 px-3 font-medium">
                                الحوض الزراعي
                              </th>
                              <th className="py-1.5 px-2 font-medium">
                                المحصول ونسبة الطين
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                تراكم الجريان D8
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                {isSplitView
                                  ? 'الرواسب العالقة TSS (أ ← ب)'
                                  : 'الرواسب العالقة (TSS)'}
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                الحمل الرسوبي اليومي
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                {isSplitView
                                  ? 'النترات NO₃-N (أ ← ب)'
                                  : 'تركيز النترات (NO₃-N)'}
                              </th>
                              <th className="py-1.5 px-3 text-left font-medium">
                                تصنيف جودة المياه (الفاو)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B] text-[11px]">
                            {simA.parcelImpacts.map((pA, idx) => {
                              const pB = simB.parcelImpacts[idx] || pA;
                              const p = activeTarget === 'A' ? pA : pB;
                              const isSel = p.id === selectedParcelId;
                              const arParcel = PARCEL_ARABIC_DATA[p.id];
                              return (
                                <tr
                                  key={p.id}
                                  onClick={() => handleSelectParcel(p)}
                                  className={`cursor-pointer ${
                                    isSel
                                      ? 'bg-sky-950/50 text-white'
                                      : 'hover:bg-[#111827]'
                                  }`}
                                >
                                  <td className="py-1.5 px-3 font-semibold text-white">
                                    {arParcel?.nameAr || p.name}
                                  </td>
                                  <td className="py-1.5 px-2 text-slate-300">
                                    {arParcel?.primaryCropAr || p.primaryCrop}{' '}
                                    <span className="text-slate-500">·</span>{' '}
                                    <span className="font-mono text-slate-400">
                                      طين {p.meanClayPct}%
                                    </span>
                                  </td>
                                  <td className="py-1.5 px-2 text-left font-mono text-sky-300">
                                    {p.meanFlowAccCells.toLocaleString()} خلية
                                  </td>
                                  {isSplitView ? (
                                    <td className="py-1.5 px-2 text-left font-mono">
                                      <span className="text-amber-300 font-semibold">
                                        {pA.tssMgL}
                                      </span>
                                      <span className="text-slate-500 mx-1">←</span>
                                      <span className="text-emerald-300 font-semibold">
                                        {pB.tssMgL}
                                      </span>{' '}
                                      <span className="text-slate-400">ملغ/ل</span>
                                    </td>
                                  ) : (
                                    <td className="py-1.5 px-2 text-left font-mono">
                                      <span className="text-amber-300 font-semibold">
                                        {p.tssMgL}
                                      </span>{' '}
                                      <span className="text-slate-400">ملغ/ل</span>
                                    </td>
                                  )}
                                  <td className="py-1.5 px-2 text-left font-mono text-white font-semibold">
                                    {p.sedimentYieldTonsDay.toFixed(1)}{' '}
                                    <span className="text-slate-400 font-normal">
                                      طن/يوم
                                    </span>
                                  </td>
                                  {isSplitView ? (
                                    <td className="py-1.5 px-2 text-left font-mono">
                                      <span className="text-sky-300 font-semibold">
                                        {pA.nitrateMgL.toFixed(1)}
                                      </span>
                                      <span className="text-slate-500 mx-1">←</span>
                                      <span className="text-emerald-300 font-semibold">
                                        {pB.nitrateMgL.toFixed(1)}
                                      </span>{' '}
                                      <span className="text-slate-400">ملغ/ل</span>
                                    </td>
                                  ) : (
                                    <td className="py-1.5 px-2 text-left font-mono">
                                      <span
                                        className={`font-semibold ${
                                          p.nitrateMgL >= 10.0
                                            ? 'text-rose-400'
                                            : 'text-sky-300'
                                        }`}
                                      >
                                        {p.nitrateMgL.toFixed(2)}
                                      </span>{' '}
                                      <span className="text-slate-400">
                                        ملغ/ل ({p.nitrateLoadKgDay} كغ/يوم)
                                      </span>
                                    </td>
                                  )}
                                  <td
                                    className={`py-1.5 px-3 text-left font-semibold whitespace-nowrap ${
                                      p.waterQualityStatus === 'Impaired'
                                        ? 'text-rose-400'
                                        : p.waterQualityStatus === 'Elevated'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {translateWaterQualityStatusAr(p.waterQualityStatus)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* 60km Orontes Longitudinal Sediment & Nitrate Plume Chart */}
                      <div className="w-full xl:w-[420px] shrink-0 p-2 bg-[#07090E] flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10.5px] px-1 pb-1">
                          <span className="text-slate-300 font-bold">
                            منحنى التلوث الطولي (60 كم: العشارنة ← قرقور)
                          </span>
                          <div className="flex items-center gap-3 font-mono">
                            <span className="text-amber-300">━ الرواسب TSS</span>
                            <span className="text-sky-300">━ النترات NO₃-N</span>
                          </div>
                        </div>
                        <div dir="ltr" className="w-full">
                        <svg
                          viewBox="0 0 400 132"
                          className="orontes-chart-svg w-full h-[126px] bg-[#0B0E17] border border-[#1E293B]"
                        >
                          {[0.25, 0.5, 0.75].map((frac, i) => {
                            const y = 12 + frac * 98;
                            return (
                              <line
                                key={i}
                                x1={34}
                                y1={y}
                                x2={366}
                                y2={y}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                            );
                          })}

                          {/* FAO / WHO 10 mg/L Nitrate Guideline Line */}
                          {(() => {
                            const yFao = 12 + 98 - (10 / 26) * 98;
                            return (
                              <g>
                                <line
                                  x1={34}
                                  y1={yFao}
                                  x2={366}
                                  y2={yFao}
                                  stroke="#f43f5e"
                                  strokeWidth={1}
                                  strokeDasharray="4 2"
                                />
                                <text
                                  x={364}
                                  y={yFao - 3}
                                  textAnchor="end"
                                  className="text-[8px] font-mono fill-rose-400"
                                >
                                  حد الفاو الآمن 10 ملغ/ل NO₃-N
                                </text>
                              </g>
                            );
                          })()}

                          {/* Left Axis Labels (TSS mg/L: 0 to 800) */}
                          <text
                            x={30}
                            y={16}
                            textAnchor="end"
                            className="text-[8.5px] font-mono fill-amber-300"
                          >
                            800
                          </text>
                          <text
                            x={30}
                            y={63}
                            textAnchor="end"
                            className="text-[8.5px] font-mono fill-amber-300"
                          >
                            400
                          </text>
                          <text
                            x={30}
                            y={110}
                            textAnchor="end"
                            className="text-[8.5px] font-mono fill-amber-300"
                          >
                            0
                          </text>

                          {/* Right Axis Labels (NO3-N mg/L: 0 to 26) */}
                          <text
                            x={370}
                            y={16}
                            textAnchor="start"
                            className="text-[8.5px] font-mono fill-sky-300"
                          >
                            26
                          </text>
                          <text
                            x={370}
                            y={63}
                            textAnchor="start"
                            className="text-[8.5px] font-mono fill-sky-300"
                          >
                            13
                          </text>
                          <text
                            x={370}
                            y={110}
                            textAnchor="start"
                            className="text-[8.5px] font-mono fill-sky-300"
                          >
                            0
                          </text>

                          {/* Sediment TSS Area & Line */}
                          <path
                            d={
                              `M 34,110 L ` +
                              sim.southNorthProfile
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        sim.southNorthProfile.length - 1
                                      )) *
                                      332;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.tssMgL / 800) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ') +
                              ` L 366,110 Z`
                            }
                            fill="rgba(245, 158, 11, 0.14)"
                          />
                          <path
                            d={
                              'M ' +
                              sim.southNorthProfile
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        sim.southNorthProfile.length - 1
                                      )) *
                                      332;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.tssMgL / 800) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth={1.8}
                          />

                          {/* Nitrate NO3-N Line */}
                          <path
                            d={
                              'M ' +
                              sim.southNorthProfile
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        sim.southNorthProfile.length - 1
                                      )) *
                                      332;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.nitrateMgL / 26) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth={1.8}
                          />

                          {/* Bottom Reach Labels */}
                          <text
                            x={34}
                            y={124}
                            className="text-[8.5px] fill-slate-400"
                          >
                            0 كم العشارنة
                          </text>
                          <text
                            x={200}
                            y={124}
                            textAnchor="middle"
                            className="text-[8.5px] fill-slate-400"
                          >
                            30 كم الحواش
                          </text>
                          <text
                            x={366}
                            y={124}
                            textAnchor="end"
                            className="text-[8.5px] fill-slate-400"
                          >
                            60 كم قرقور
                          </text>
                        </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {bottomTab === 'hydrograph' && (
                  <div className="flex flex-col h-full">
                    {/* Telemetry Header Strip */}
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-sky-300 font-bold">
                          المخطط المائي للعاصفة (72 ساعة) والأحواض الفرعية للأودية الغربية ({activeTarget === 'A' ? 'السيناريو أ' : 'السيناريو ب'})
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="font-mono text-slate-400">
                          معامل ماننغ n = {sim.summary.meanFloodplainManningN} · أقصى سرعة {sim.summary.maxBasinVelocityMs} م/ث
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">
                          ذروة تصريف قرقور Qₚ:{' '}
                          <strong className="text-rose-400">
                            {sim.summary.peakKarkorOutflowM3s} م³/ث
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          زمن تأخر الموجة الفيضية:{' '}
                          <strong className="text-amber-300">
                            {sim.summary.karkorLagTimeHours} ساعة
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          حجم الاحتجاز المائي بالسهل:{' '}
                          <strong className="text-sky-300">
                            {sim.summary.peakFloodplainStorageMm3} مليون م³
                          </strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectLayerWithDef('velocity')}
                          className="text-sky-400 hover:underline font-sans"
                        >
                          عرض طبقة سرعة ماننغ على الخريطة ←
                        </button>
                      </div>
                    </div>

                    {/* Split Layout: Left 72-Hr Multi-Station Hydrograph SVG + Right Western Wadi Sub-Catchments Table */}
                    <div className="flex-1 min-h-0 flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x xl:divide-x-reverse divide-[#1E293B] overflow-auto">
                      {/* 72-Hour Storm Hydrograph & Hyetograph */}
                      <div className="w-full xl:w-[460px] shrink-0 p-2 bg-[#07090E] flex flex-col justify-between">
                        <div className="flex items-center justify-between text-[10px] px-1 pb-1">
                          <span className="text-slate-300 font-bold">
                            توجيه الموجة الفيضية (72 ساعة - م³/ث)
                          </span>
                          <div className="flex items-center gap-2.5 font-mono">
                            <span className="text-slate-400">━ العشارنة</span>
                            <span className="text-amber-300">━ الزيارة</span>
                            <span className="text-sky-300">━ قرقور</span>
                            {isSplitView && (
                              <span className="text-emerald-300">╌ قرقور (ب)</span>
                            )}
                          </div>
                        </div>
                        <div dir="ltr" className="w-full">
                        <svg
                          viewBox="0 0 430 132"
                          className="orontes-chart-svg w-full h-[126px] bg-[#0B0E17] border border-[#1E293B] cursor-pointer"
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX =
                              ((e.clientX - rect.left) / Math.max(1, rect.width)) *
                              430;
                            const frac = Math.max(
                              0,
                              Math.min(1, (relX - 34) / 376)
                            );
                            const hr = Math.round((frac * 72) / 2) * 2;
                            setIsFloodWavePlaying(false);
                            setActiveFloodWaveHour(hr);
                          }}
                        >
                          {[100, 200, 300].map((qVal) => {
                            const y = 12 + 98 - (qVal / 360) * 98;
                            return (
                              <g key={qVal}>
                                <line
                                  x1={34}
                                  y1={y}
                                  x2={410}
                                  y2={y}
                                  stroke="#1e293b"
                                  strokeDasharray="3 3"
                                />
                                <text
                                  x={30}
                                  y={y + 3}
                                  textAnchor="end"
                                  className="text-[8.5px] font-mono fill-slate-400"
                                >
                                  {qVal}
                                </text>
                              </g>
                            );
                          })}

                          {/* Karkor Weir Effective Capacity Threshold Line */}
                          {(() => {
                            const cap =
                              sim.stormHydrograph[0]?.karkorSpillwayCapacityM3s ||
                              150;
                            const yCap = 12 + 98 - Math.min(1, cap / 360) * 98;
                            return (
                              <g>
                                <line
                                  x1={34}
                                  y1={yCap}
                                  x2={410}
                                  y2={yCap}
                                  stroke="#f43f5e"
                                  strokeWidth={1}
                                  strokeDasharray="4 2"
                                />
                                <text
                                  x={408}
                                  y={yCap - 3}
                                  textAnchor="end"
                                  className="text-[8px] font-mono fill-rose-400"
                                >
                                  سعة ناظم قرقور ({cap} م³/ث)
                                </text>
                              </g>
                            );
                          })()}

                          {/* Asharne Southern Inflow Curve */}
                          <path
                            d={
                              'M ' +
                              sim.stormHydrograph
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        sim.stormHydrograph.length - 1
                                      )) *
                                      376;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.asharneInflowM3s / 360) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#64748b"
                            strokeWidth={1.4}
                          />

                          {/* Ziyarah Mid-Basin Curve */}
                          <path
                            d={
                              'M ' +
                              sim.stormHydrograph
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        sim.stormHydrograph.length - 1
                                      )) *
                                      376;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.ziyarahMidBasinM3s / 360) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth={1.6}
                          />

                          {/* Karkor Northern Outflow Area & Curve */}
                          <path
                            d={
                              `M 34,110 L ` +
                              simA.stormHydrograph
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        simA.stormHydrograph.length - 1
                                      )) *
                                      376;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.karkorOutflowM3s / 360) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ') +
                              ` L 410,110 Z`
                            }
                            fill="rgba(56, 189, 248, 0.14)"
                          />
                          <path
                            d={
                              'M ' +
                              simA.stormHydrograph
                                .map((pt, idx) => {
                                  const x =
                                    34 +
                                    (idx /
                                      Math.max(
                                        1,
                                        simA.stormHydrograph.length - 1
                                      )) *
                                      376;
                                  const y =
                                    12 +
                                    98 -
                                    Math.min(1, pt.karkorOutflowM3s / 360) * 98;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth={2}
                          />

                          {/* Scenario B Karkor Outflow Curve (When Split-View is active) */}
                          {isSplitView && (
                            <path
                              d={
                                'M ' +
                                simB.stormHydrograph
                                  .map((pt, idx) => {
                                    const x =
                                      34 +
                                      (idx /
                                        Math.max(
                                          1,
                                          simB.stormHydrograph.length - 1
                                        )) *
                                        376;
                                    const y =
                                      12 +
                                      98 -
                                      Math.min(1, pt.karkorOutflowM3s / 360) * 98;
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  })
                                  .join(' L ')
                              }
                              fill="none"
                              stroke="#34d399"
                              strokeWidth={1.8}
                              strokeDasharray="4 2"
                            />
                          )}

                          {/* Active Flood Wave Time Cursor */}
                          {activeFloodWaveHour !== null && (
                            <g>
                              <line
                                x1={34 + (activeFloodWaveHour / 72) * 376}
                                y1={10}
                                x2={34 + (activeFloodWaveHour / 72) * 376}
                                y2={110}
                                stroke="#fbbf24"
                                strokeWidth={1.6}
                              />
                              <text
                                x={Math.min(
                                  395,
                                  Math.max(50, 34 + (activeFloodWaveHour / 72) * 376)
                                )}
                                y={20}
                                textAnchor="middle"
                                className="text-[8.5px] font-mono fill-amber-300 font-bold"
                              >
                                T+{activeFloodWaveHour}h
                              </text>
                            </g>
                          )}

                          <text
                            x={34}
                            y={124}
                            className="text-[8.5px] font-mono fill-slate-400"
                          >
                            0 ساعة
                          </text>
                          <text
                            x={159}
                            y={124}
                            textAnchor="middle"
                            className="text-[8.5px] font-mono fill-slate-400"
                          >
                            24 ساعة
                          </text>
                          <text
                            x={284}
                            y={124}
                            textAnchor="middle"
                            className="text-[8.5px] font-mono fill-slate-400"
                          >
                            48 ساعة
                          </text>
                          <text
                            x={410}
                            y={124}
                            textAnchor="end"
                            className="text-[8.5px] font-mono fill-slate-400"
                          >
                            72 ساعة
                          </text>
                        </svg>
                        </div>
                      </div>

                      {/* Western Jabal Ansariyah Wadi Sub-Catchment Table */}
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-right border-collapse text-xs tabular-nums">
                          <thead className="sticky top-0 bg-[#111827] text-[10.5px] text-slate-400 border-b border-[#1E293B]">
                            <tr>
                              <th className="py-1.5 px-3 font-medium">
                                الحوض الفرعي / الوادي الساحلي الغربي
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                المساحة الصبّابة والميل
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                زمن التركيز كيربيتش (T꜀)
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                معامل الجريان السطحي (C)
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                ذروة التدفق السيلي (Qₚ)
                              </th>
                              <th className="py-1.5 px-2 text-left font-medium">
                                أقصى سرعة (ماننغ)
                              </th>
                              <th className="py-1.5 px-3 text-left font-medium">
                                خطر الانجراف والحتّ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1E293B] text-[11px]">
                            {sim.subCatchments.map((sc) => (
                              <tr
                                key={sc.id}
                                onClick={() => {
                                  const grid = latLonToGrid(
                                    sc.outletLat,
                                    sc.outletLon
                                  );
                                  setSelectedCell(grid);
                                  handleSelectLayerWithDef('velocity');
                                  setMobileView('map');
                                }}
                                className="cursor-pointer hover:bg-[#111827]"
                              >
                                <td className="py-1.5 px-3 font-semibold text-white">
                                  {sc.arabicName}{' '}
                                  <span className="text-slate-400 font-normal text-[10px]">
                                    ({sc.name})
                                  </span>
                                </td>
                                <td className="py-1.5 px-2 text-left font-mono text-slate-300">
                                  {sc.drainageAreaKm2.toFixed(1)} كم² ·{' '}
                                  <span className="text-emerald-300 font-semibold">
                                    {sc.meanSlopePct}%
                                  </span>{' '}
                                  ({sc.meanSlopeDeg}°)
                                </td>
                                <td className="py-1.5 px-2 text-left font-mono text-sky-300">
                                  {sc.timeOfConcentrationHr.toFixed(2)} ساعة
                                </td>
                                <td className="py-1.5 px-2 text-left font-mono text-slate-300">
                                  {sc.runoffCoeffC.toFixed(2)}
                                </td>
                                <td className="py-1.5 px-2 text-left font-mono font-semibold text-amber-300">
                                  {sc.peakDischargeM3s.toFixed(1)} م³/ث
                                </td>
                                <td className="py-1.5 px-2 text-left font-mono font-semibold text-white">
                                  {sc.maxVelocityMs.toFixed(2)} م/ث
                                </td>
                                <td
                                  className={`py-1.5 px-3 text-left font-semibold ${
                                    sc.erosionHazard === 'Extreme'
                                      ? 'text-rose-400'
                                      : sc.erosionHazard === 'High'
                                      ? 'text-amber-400'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {translateErosionHazardAr(sc.erosionHazard)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {bottomTab === 'historical-sar' && (
                  <div className="flex flex-col h-full">
                    <div className="px-3 py-1.5 bg-[#111827] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-amber-300 font-bold">
                          {activeHistEventAr.titleAr}
                        </span>
                        <span className="text-slate-400 mr-2 text-[10.5px]">
                          ({activeHistEventAr.sensorAr})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 font-mono tabular-nums">
                        <span className="text-slate-300">
                          نسبة الإصابة المكانية:{' '}
                          <strong className="text-emerald-400">
                            {sim.historicalComparison.hitRatePct}%
                          </strong>
                        </span>
                        <span className="text-slate-300">
                          مؤشر النجاح الحرج CSI:{' '}
                          <strong className="text-sky-300">
                            {sim.historicalComparison.criticalSuccessIndexPct}%
                          </strong>
                        </span>
                      </div>
                    </div>

                    <table className="w-full text-right border-collapse text-xs tabular-nums">
                      <thead className="sticky top-0 bg-[#111827] text-[10.5px] text-slate-400 border-b border-[#1E293B]">
                        <tr>
                          <th className="py-1.5 px-3 font-medium">
                            نطاق الغمر التاريخي المرصود بالرادار
                          </th>
                          <th className="py-1.5 px-2 font-medium">القطاع الجغرافي</th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            المساحة المرصودة (SAR)
                          </th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            أقصى عمق مرصود
                          </th>
                          <th className="py-1.5 px-2 text-left font-medium">
                            تطابق النموذج الهيدرولوجي
                          </th>
                          <th className="py-1.5 px-3 text-left font-medium">
                            التقييم الهيدروليكي المقارن
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1E293B] text-[11px]">
                        {sim.historicalComparison.zoneBreakdown.map((z) => {
                          const rawZone = activeHistEvent.zones.find(
                            (rz) => rz.zoneId === z.zoneId
                          );
                          const arZone = activeHistEventAr.zonesAr[z.zoneId];
                          return (
                            <tr
                              key={z.zoneId}
                              onClick={() => {
                                setShowHistoricalExtent(true);
                                if (rawZone) {
                                  const cLat =
                                    rawZone.latLonPolygon.reduce(
                                      (acc, p) => acc + p[0],
                                      0
                                    ) / rawZone.latLonPolygon.length;
                                  const cLon =
                                    rawZone.latLonPolygon.reduce(
                                      (acc, p) => acc + p[1],
                                      0
                                    ) / rawZone.latLonPolygon.length;
                                  setSelectedCell(latLonToGrid(cLat, cLon));
                                  setMobileView('map');
                                }
                              }}
                              className="cursor-pointer hover:bg-[#111827]"
                            >
                              <td className="py-2 px-3 font-semibold text-slate-100">
                                {arZone?.nameAr || z.zoneName}
                              </td>
                              <td className="py-2 px-2 text-slate-300">
                                {arZone?.sectorAr || z.sector}
                              </td>
                              <td className="py-2 px-2 text-left font-mono text-white font-semibold">
                                {z.observedAreaHa.toLocaleString()} هكتار
                              </td>
                              <td className="py-2 px-2 text-left font-mono text-slate-300">
                                {z.observedMaxDepthM.toFixed(2)} م
                              </td>
                              <td className="py-2 px-2 text-left font-mono font-semibold text-sky-300">
                                {z.modeledOverlapPct}%
                              </td>
                              <td
                                className={`py-2 px-3 text-left font-semibold ${
                                  z.recurrenceStatus ===
                                  'Expansion Beyond Historical'
                                    ? 'text-amber-400'
                                    : z.recurrenceStatus === 'Chronic Match'
                                    ? 'text-rose-400'
                                    : 'text-emerald-400'
                                }`}
                              >
                                {translateRecurrenceStatusAr(z.recurrenceStatus)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {bottomTab === 'transect-we' && (
                  <div className="p-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 h-full">
                    <div className="flex-1 min-h-[150px] h-full" dir="ltr">
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="orontes-chart-svg w-full h-full bg-[#07090E] border border-[#1E293B]"
                        onMouseMove={(e) => {
                          if (simplifiedMode) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = ((e.clientX - rect.left) / rect.width) * svgW;
                          const frac = Math.max(0, Math.min(1, (relX - padL) / plotW));
                          const idx = Math.round(
                            frac * (simA.westEastTransect.length - 1)
                          );
                          setTransectHoverIdx(idx);
                        }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relX = ((e.clientX - rect.left) / rect.width) * svgW;
                          const frac = Math.max(0, Math.min(1, (relX - padL) / plotW));
                          const idx = Math.round(
                            frac * (simA.westEastTransect.length - 1)
                          );
                          setTransectHoverIdx(idx);
                          const { row } = latLonToGrid(35.512, 36.334);
                          setSelectedCell({ col: idx, row });
                        }}
                      >
                        {[200, 500, 800, 1100].map((elev) => {
                          const y =
                            padT + plotH - ((elev - 150) / (1150 - 150)) * plotH;
                          return (
                            <g key={elev}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={padL + plotW}
                                y2={y}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padL - 6}
                                y={y + 3}
                                textAnchor="end"
                                className="text-[9px] font-mono fill-slate-400"
                              >
                                {elev}م
                              </text>
                            </g>
                          );
                        })}

                        {showHistoricalExtent &&
                          (simplifiedMode ? (
                            histTransectBounds && (
                              <rect
                                x={histTransectBounds.x}
                                y={padT}
                                width={histTransectBounds.width}
                                height={plotH}
                                fill="rgba(245, 158, 11, 0.14)"
                              />
                            )
                          ) : (
                            sim.westEastTransect.map((pt, i) => {
                              if (!pt.inHistoricalExtent) return null;
                              const x =
                                padL +
                                (i / (sim.westEastTransect.length - 1)) * plotW;
                              const colW = plotW / sim.westEastTransect.length + 1;
                              return (
                                <rect
                                  key={i}
                                  x={x - colW / 2}
                                  y={padT}
                                  width={colW}
                                  height={plotH}
                                  fill="rgba(245, 158, 11, 0.14)"
                                />
                              );
                            })
                          ))}

                        <path
                          d={
                            `M ${padL},${padT + plotH} L ` +
                            sampledWestEast
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.westEastTransect.length - 1)) * plotW;
                                const y =
                                  padT +
                                  plotH -
                                  ((ptA.elevationM - 150) / (1150 - 150)) * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ') +
                            ` L ${padL + plotW},${padT + plotH} Z`
                          }
                          fill="rgba(51, 65, 85, 0.35)"
                        />
                        <path
                          d={
                            'M ' +
                            sampledWestEast
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.westEastTransect.length - 1)) * plotW;
                                const y =
                                  padT +
                                  plotH -
                                  ((ptA.elevationM - 150) / (1150 - 150)) * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ')
                          }
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth={1.8}
                        />

                        {/* Scenario A FSI Curve */}
                        <path
                          d={
                            'M ' +
                            sampledWestEast
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.westEastTransect.length - 1)) * plotW;
                                const y = padT + plotH - ptA.fsi * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ')
                          }
                          fill="none"
                          stroke="#fb7185"
                          strokeWidth={2}
                        />

                        {/* Scenario B FSI Curve */}
                        {isSplitView && (
                          <path
                            d={
                              'M ' +
                              sampledWestEast
                                .map(({ ptB, idx }) => {
                                  const x =
                                    padL +
                                    (idx / (simA.westEastTransect.length - 1)) * plotW;
                                  const y = padT + plotH - ptB.fsi * plotH;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={2}
                            strokeDasharray="4 2"
                          />
                        )}

                        <line
                          x1={
                            padL +
                            (transectHoverIdx / (simA.westEastTransect.length - 1)) *
                              plotW
                          }
                          y1={padT}
                          x2={
                            padL +
                            (transectHoverIdx / (simA.westEastTransect.length - 1)) *
                              plotW
                          }
                          y2={padT + plotH}
                          stroke="#38bdf8"
                          strokeWidth={1.2}
                        />

                        {/* Bottom X-Axis Labels (West to East) */}
                        <text
                          x={padL}
                          y={svgH - 6}
                          textAnchor="start"
                          className="text-[9.5px] fill-slate-400"
                        >
                          الغرب: جبل النصيرية (36.18°E)
                        </text>
                        <text
                          x={padL + plotW / 2}
                          y={svgH - 6}
                          textAnchor="middle"
                          className="text-[9.5px] fill-sky-300"
                        >
                          قاع سهل الغاب ومجرى نهر العاصي (36.33°E)
                        </text>
                        <text
                          x={padL + plotW}
                          y={svgH - 6}
                          textAnchor="end"
                          className="text-[9.5px] fill-slate-400"
                        >
                          الشرق: جبل الزاوية (36.48°E)
                        </text>
                      </svg>
                    </div>

                    {simA.westEastTransect[transectHoverIdx] && (
                      <div className="w-full md:w-[270px] shrink-0 bg-[#07090E] border border-[#1E293B] p-2.5 text-xs space-y-1 tabular-nums">
                        <div className="text-[11px] font-bold text-sky-400 border-b border-[#1E293B] pb-1">
                          المقطع الطبوغرافي العرضي ({simA.westEastTransect[transectHoverIdx].lon.toFixed(3)}° شرقاً)
                        </div>
                        <div className="text-[10.5px] text-amber-300 font-medium">
                          {translateLandformAr(
                            simA.westEastTransect[transectHoverIdx].zoneLabel || ''
                          )}
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-sans">الارتفاع عن البحر:</span>
                          <span className="text-white">
                            {simA.westEastTransect[transectHoverIdx].elevationM.toFixed(1)} م
                          </span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-sans">نسبة الانحدار (Slope %):</span>
                          <span className="text-emerald-300 font-semibold">
                            {simA.westEastTransect[transectHoverIdx].slopePct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-sans">التراكم المائي D8:</span>
                          <span className="text-sky-300 font-semibold">
                            {simA.westEastTransect[transectHoverIdx].flowAcc.toLocaleString()} خلية
                          </span>
                        </div>
                        <div className="flex justify-between font-mono">
                          <span className="text-slate-400 font-sans">مؤشر الفيضان FSI (أ):</span>
                          <span className="text-rose-400 font-semibold">
                            {simA.westEastTransect[transectHoverIdx].fsi.toFixed(2)}
                          </span>
                        </div>
                        {isSplitView && simB.westEastTransect[transectHoverIdx] && (
                          <div className="flex justify-between font-mono">
                            <span className="text-slate-400 font-sans">مؤشر الفيضان FSI (ب):</span>
                            <span className="text-emerald-400 font-semibold">
                              {simB.westEastTransect[transectHoverIdx].fsi.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {bottomTab === 'profile-sn' && (
                  <div className="p-2 flex flex-col md:flex-row items-stretch md:items-center gap-3 h-full">
                    <div className="flex-1 min-h-[150px] h-full" dir="ltr">
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="orontes-chart-svg w-full h-full bg-[#07090E] border border-[#1E293B]"
                      >
                        {[168, 176, 184, 192].map((elev) => {
                          const y =
                            padT + plotH - ((elev - 164) / (196 - 164)) * plotH;
                          return (
                            <g key={elev}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={padL + plotW}
                                y2={y}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padL - 6}
                                y={y + 3}
                                textAnchor="end"
                                className="text-[9px] font-mono fill-slate-400"
                              >
                                {elev}م
                              </text>
                            </g>
                          );
                        })}

                        <path
                          d={
                            'M ' +
                            sampledSouthNorth
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.southNorthProfile.length - 1)) * plotW;
                                const y =
                                  padT +
                                  plotH -
                                  ((ptA.bedElevationM - 164) / (196 - 164)) * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ')
                          }
                          fill="none"
                          stroke="#64748b"
                          strokeWidth={2}
                        />

                        <path
                          d={
                            'M ' +
                            sampledSouthNorth
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.southNorthProfile.length - 1)) * plotW;
                                const y =
                                  padT +
                                  plotH -
                                  ((ptA.bankElevationM - 164) / (196 - 164)) * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ')
                          }
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                        />

                        {/* Scenario A Water Stage */}
                        <path
                          d={
                            'M ' +
                            sampledSouthNorth
                              .map(({ ptA, idx }) => {
                                const x =
                                  padL +
                                  (idx / (simA.southNorthProfile.length - 1)) * plotW;
                                const y =
                                  padT +
                                  plotH -
                                  ((ptA.waterStageM - 164) / (196 - 164)) * plotH;
                                return `${x.toFixed(1)},${y.toFixed(1)}`;
                              })
                              .join(' L ')
                          }
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={2.2}
                        />

                        {/* Scenario B Water Stage */}
                        {isSplitView && (
                          <path
                            d={
                              'M ' +
                              sampledSouthNorth
                                .map(({ ptB, idx }) => {
                                  const x =
                                    padL +
                                    (idx / (simA.southNorthProfile.length - 1)) * plotW;
                                  const y =
                                    padT +
                                    plotH -
                                    ((ptB.waterStageM - 164) / (196 - 164)) * plotH;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                })
                                .join(' L ')
                            }
                            fill="none"
                            stroke="#34d399"
                            strokeWidth={2}
                            strokeDasharray="4 2"
                          />
                        )}

                        {/* Bottom X-Axis Labels (South 0km to North 60km) */}
                        <text
                          x={padL}
                          y={svgH - 6}
                          textAnchor="start"
                          className="text-[9.5px] fill-slate-400"
                        >
                          0 كم: سدة العشارنة جنوباً (190 م)
                        </text>
                        <text
                          x={padL + plotW / 2}
                          y={svgH - 6}
                          textAnchor="middle"
                          className="text-[9.5px] fill-sky-300"
                        >
                          30 كم: سهل الزيارة والحواش الأوسط
                        </text>
                        <text
                          x={padL + plotW}
                          y={svgH - 6}
                          textAnchor="end"
                          className="text-[9.5px] fill-slate-400"
                        >
                          60 كم: مضيق وسد قرقور شمالاً (168 م)
                        </text>
                      </svg>
                    </div>
                    <div className="w-full md:w-[270px] shrink-0 bg-[#07090E] border border-[#1E293B] p-2.5 text-xs space-y-1.5">
                      <div className="text-[11px] font-bold text-sky-400 border-b border-[#1E293B] pb-1">
                        المقطع الطولي لمنسوب نهر العاصي (60 كم)
                      </div>
                      <p className="text-[10.5px] text-slate-400 leading-relaxed">
                        ينحدر قاع نهر العاصي ببطء شديد من سدة العشارنة جنوباً (190 م) إلى مضيق قرقور شمالاً (168 م) بميل وسطي (0.036%)، ما يسبب طفح المياه فوق الأكتاف الترابية عند انسداد المصارف.
                      </p>
                      <div className="space-y-1 text-[11px] pt-1">
                        <div className="flex items-center gap-2 text-sky-300">
                          <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                          منسوب سطح الماء (السيناريو أ)
                        </div>
                        {isSplitView && (
                          <div className="flex items-center gap-2 text-emerald-300">
                            <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
                            منسوب سطح الماء (السيناريو ب)
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-amber-300">
                          <span className="w-3 h-0.5 bg-amber-400 inline-block" />
                          منسوب قمة ضفاف القنوات والسدود الترابية
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

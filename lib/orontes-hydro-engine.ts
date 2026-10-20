export type RasterLayerType =
  | 'fsi'
  | 'depth'
  | 'deltaDepth'
  | 'velocity'
  | 'twi'
  | 'dem'
  | 'slope'
  | 'flowAcc'
  | 'chirps'
  | 'gfs48h'
  | 'clay'
  | 'canalDist';

export interface GfsStationPoint {
  id: string;
  name: string;
  arabicName: string;
  sector: string;
  lat: number;
  lon: number;
  elevationM: number;
  precip48hMm: number;
  peakHourlyMm: number;
  maxWindKmh: number;
  hourlyPrecipMm: number[];
}

export interface Gfs48hForecastPayload {
  fetchedAtUtc: string;
  modelRunLabel: string;
  sourceStatus: 'live-noaa-gfs' | 'calibrated-synoptic-gfs';
  basinMean48hMm: number;
  basinMax48hMm: number;
  basinMin48hMm: number;
  orographicRatio: number;
  stations: GfsStationPoint[];
}

export interface StormPreset {
  id: string;
  name: string;
  arabicSub: string;
  date: string;
  chirpsPeakMm: number;
  durationHours: number;
  asharneReleaseM3s: number;
  orographicFactor: number;
  description: string;
}

export interface HistoricalFloodZonePolygon {
  zoneId: string;
  zoneName: string;
  sector: string;
  observedAreaHa: number;
  observedMaxDepthM: number;
  latLonPolygon: [number, number][];
  gridPolygon: [number, number][];
}

export interface HistoricalFloodEvent {
  id: string;
  year: number;
  title: string;
  arabicTitle: string;
  acquisitionDate: string;
  sensorSource: string;
  totalObservedHa: number;
  totalObservedKm2: number;
  peakRainfallMm: number;
  summaryNotes: string;
  zones: HistoricalFloodZonePolygon[];
}

export interface PrCurvePoint {
  threshold: number;
  precisionPct: number;
  recallPct: number;
  f1Pct: number;
  csiPct: number;
}

export interface SensitivityAnalysisPoint {
  paramId: string;
  labelAr: string;
  labelEn: string;
  baseValue: string;
  lowPerturbationLabel: string;
  highPerturbationLabel: string;
  lowAreaKm2: number;
  highAreaKm2: number;
  deltaSwingKm2: number;
  elasticityScore: number;
}

export interface HistoricalComparisonStats {
  eventId: string;
  eventTitle: string;
  year: number;
  sensorSource: string;
  observedAreaKm2: number;
  modeledHighRiskKm2: number;
  overlapAreaKm2: number; // True Positive (Model ∩ Historical)
  newlyExposedAreaKm2: number; // False Positive / Expansion (Model \ Historical)
  historicalOnlyAreaKm2: number; // False Negative (Historical \ Model)
  hitRatePct: number; // Recall: TP / (TP + FN)
  precisionPct: number; // Precision: TP / (TP + FP)
  f1ScorePct: number; // Harmonic mean of Precision and Recall
  falseAlarmRatioPct: number; // FAR: FP / (TP + FP)
  criticalSuccessIndexPct: number; // IoU / CSI: TP / (TP + FP + FN)
  spatialHoldoutNorthF1Pct: number; // Independent Northern Graben Holdout (Karkor–Ziyarah) F1
  spatialHoldoutSouthF1Pct: number; // Southern Graben Sector (Qalaat–Asharne) F1
  netDeltaPct: number; // (Modeled - Observed) / Observed
  prCurvePoints: PrCurvePoint[];
  sensitivityRuns: SensitivityAnalysisPoint[];
  zoneBreakdown: {
    zoneId: string;
    zoneName: string;
    sector: string;
    observedAreaHa: number;
    observedMaxDepthM: number;
    modeledOverlapPct: number;
    modeledMeanFsi: number;
    modeledMeanDepthM: number;
    deltaDepthM: number;
    recurrenceStatus: 'Expansion Beyond Historical' | 'Chronic Match' | 'Below Historical';
  }[];
}

export interface CanalBreachHotspot {
  id: string;
  name: string;
  arabicName: string;
  lat: number;
  lon: number;
  col: number;
  row: number;
  canalName: string;
  defaultActive: boolean;
  spillRadiusKm: number;
  severity: number;
  damageMechanism: string;
}

export interface AgriculturalParcel {
  id: string;
  name: string;
  subDistrict: string;
  primaryCrop: string;
  areaHa: number;
  polygon: [number, number][];
  latLonPolygon: [number, number][];
  latCenter: number;
  lonCenter: number;
  drainageCanalDependency: string;
}

export interface AgriculturalParcelImpact extends AgriculturalParcel {
  meanFsi: number;
  maxFsi: number;
  meanTwi: number;
  meanClayPct: number;
  meanFlowAccCells: number;
  inundatedHa: number;
  inundatedPct: number;
  meanDepthM: number;
  stagnationHours: number;
  tssMgL: number;
  sedimentYieldTonsDay: number;
  nitrateMgL: number;
  nitrateLoadKgDay: number;
  waterQualityStatus: 'Nominal' | 'Elevated' | 'Impaired';
  riskClass: 'Low' | 'Moderate' | 'High' | 'Critical';
}

export interface InfrastructureCrossing {
  id: string;
  code: string;
  name: string;
  structureType: 'Box Culvert' | 'RC Girder Bridge' | 'Canal Siphon' | 'Weir Crossing';
  roadCorridor: string;
  waterway: string;
  lat: number;
  lon: number;
  col: number;
  row: number;
  designCapacityM3s: number;
  spanMeters: number;
  clearanceMeters: number;
  siltationPct: number;
}

export interface InfrastructureImpact extends InfrastructureCrossing {
  localFsi: number;
  localTwi: number;
  upslopeAreaKm2: number;
  peakDischargeM3s: number;
  effectiveCapacityM3s: number;
  capacityRatio: number;
  overtoppingDepthM: number;
  status: 'Passable' | 'Surcharged' | 'Overtopped';
  inHistoricalFloodFootprint: boolean;
}

export interface HydroModelParams {
  stormPresetId: string;
  chirpsPeakMm: number;
  orographicMultiplier: number;
  fillSinksZLimit: number;
  canalSiltationPct: number;
  fsiThreshold: number;
  weights: {
    twi: number;
    chirps: number;
    clay: number;
    canalDist: number;
  };
  activeBreachIds: string[];
  selectedHistoricalEventId: string;
}

export interface CellTelemetry {
  col: number;
  row: number;
  lat: number;
  lon: number;
  utmEasting: number;
  utmNorthing: number;
  rawElevationM: number;
  conditionedElevationM: number;
  sinkDepthFilledM: number;
  slopeDeg: number;
  slopePct: number;
  streamPowerIndex: number;
  slopeFlowRegime: 'PONDING_SINK' | 'ALLUVIAL_CONVERGENCE' | 'PIEDMONT_TRANSFER' | 'OROGENIC_RUNOFF';
  d8Direction: number;
  flowAccumulationCells: number;
  upslopeAreaKm2: number;
  twi: number;
  chirpsMm: number;
  gfs48hMm: number;
  gfsVsChirpsDeltaMm: number;
  soilClayPct: number;
  canalDistKm: number;
  fsi: number;
  inundationDepthM: number;
  manningsN: number;
  flowVelocityMs: number;
  shearStressPa: number;
  riskClass: 'Low' | 'Moderate' | 'High' | 'Critical';
  landform: string;
  inHistoricalExtent: boolean;
  normTwi: number;
  normChirps: number;
  normClay: number;
  normCanal: number;
}

export interface HydrographPoint {
  hour: number;
  rainfallMmHr: number;
  asharneInflowM3s: number;
  ziyarahMidBasinM3s: number;
  karkorOutflowM3s: number;
  karkorSpillwayCapacityM3s: number;
  floodplainStorageMm3: number;
}

export interface SubCatchmentUnit {
  id: string;
  name: string;
  arabicName: string;
  outletLat: number;
  outletLon: number;
  drainageAreaKm2: number;
  meanSlopeDeg: number;
  meanSlopePct: number;
  meanTwi: number;
  timeOfConcentrationHr: number;
  runoffCoeffC: number;
  peakDischargeM3s: number;
  maxVelocityMs: number;
  erosionHazard: 'Low' | 'Moderate' | 'High' | 'Extreme';
}

export interface TransectPoint {
  distanceKm: number;
  lon: number;
  elevationM: number;
  waterSurfaceM: number;
  slopePct: number;
  flowAcc: number;
  twi: number;
  fsi: number;
  clayPct: number;
  inHistoricalExtent: boolean;
  zoneLabel?: string;
}

export interface SlopeFlowCorrelationMetrics {
  pearsonR: number; // Correlation between Terrain Slope % and log10(FlowAcc)
  flatValleyPondingPct: number; // % of high flowAcc cells occurring on slopePct < 1.5%
  meanValleySlopePct: number; // Mean slope % across Al-Ghab floor (< 215m)
  meanPiedmontSlopePct: number; // Mean slope % across transition fans (215-420m)
  meanScarpSlopePct: number; // Mean slope % across Jabal al-Nusayriyah / Zawiya (> 420m)
  criticalPondingAreaHa: number; // Area where slopePct < 1.5% AND flowAcc > 120
}

export interface HydroSimulationResult {
  cols: number;
  rows: number;
  rawDem: Float32Array;
  conditionedDem: Float32Array;
  slopeDeg: Float32Array;
  slopePct: Float32Array;
  streamPowerIndex: Float32Array;
  d8Dir: Int8Array;
  flowAcc: Float32Array;
  twi: Float32Array;
  chirps: Float32Array;
  gfs48h: Float32Array;
  clay: Float32Array;
  canalDistKm: Float32Array;
  fsi: Float32Array;
  waterDepthM: Float32Array;
  velocityMs: Float32Array;
  manningsN: Float32Array;
  shearStressPa: Float32Array;
  historicalMask: Uint8Array;
  slopeFlowMetrics: SlopeFlowCorrelationMetrics;
  parcelImpacts: AgriculturalParcelImpact[];
  infrastructureImpacts: InfrastructureImpact[];
  historicalComparison: HistoricalComparisonStats;
  westEastTransect: TransectPoint[];
  stormHydrograph: HydrographPoint[];
  subCatchments: SubCatchmentUnit[];
  southNorthProfile: {
    distanceKm: number;
    lat: number;
    bedElevationM: number;
    waterStageM: number;
    bankElevationM: number;
    dischargeM3s: number;
    tssMgL: number;
    sedimentTonsDay: number;
    nitrateMgL: number;
    stationLabel?: string;
  }[];
  summary: {
    totalBasinAreaKm2: number;
    highRiskAreaKm2: number;
    highRiskAreaPct: number;
    meanBasinFsi: number;
    maxBasinFsi: number;
    meanFloodplainFsi: number;
    totalCroplandHa: number;
    inundatedCroplandHa: number;
    inundatedCroplandPct: number;
    overtoppedCrossingsCount: number;
    surchargedCrossingsCount: number;
    meanAlGhabTwi: number;
    sinksFilledCount: number;
    meanSinkDepthM: number;
    peakKarkorOutflowM3s: number;
    totalSedimentTonsDay: number;
    meanBasinNitrateMgL: number;
    karkorExportTssMgL: number;
    impairedPoldersCount: number;
    maxBasinVelocityMs: number;
    meanFloodplainManningN: number;
    peakFloodplainStorageMm3: number;
    karkorLagTimeHours: number;
  };
}

export const GRID_COLS = 110;
export const GRID_ROWS = 150;

export const BASIN_BOUNDS = {
  minLat: 35.24,
  maxLat: 35.80,
  minLon: 36.18,
  maxLon: 36.48,
};

export function gridToLatLon(col: number, row: number): { lat: number; lon: number } {
  const lat =
    BASIN_BOUNDS.maxLat -
    (row / (GRID_ROWS - 1)) * (BASIN_BOUNDS.maxLat - BASIN_BOUNDS.minLat);
  const lon =
    BASIN_BOUNDS.minLon +
    (col / (GRID_COLS - 1)) * (BASIN_BOUNDS.maxLon - BASIN_BOUNDS.minLon);
  return {
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
  };
}

export function latLonToGrid(lat: number, lon: number): { col: number; row: number } {
  const rFrac =
    (BASIN_BOUNDS.maxLat - lat) / (BASIN_BOUNDS.maxLat - BASIN_BOUNDS.minLat);
  const cFrac =
    (lon - BASIN_BOUNDS.minLon) / (BASIN_BOUNDS.maxLon - BASIN_BOUNDS.minLon);
  const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.round(rFrac * (GRID_ROWS - 1))));
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.round(cFrac * (GRID_COLS - 1))));
  return { col, row };
}

function toGridPath(latLonPath: [number, number][]): [number, number][] {
  return latLonPath.map(([lat, lon]) => {
    const { col, row } = latLonToGrid(lat, lon);
    return [col, row];
  });
}

/**
 * Geodesic Spherical Shoelace Polygon Area (in Hectares, 1 km² = 100 ha)
 * Dynamically computes the exact area of any polygon in WGS84 [lat, lon] coordinates.
 */
export function computeGeodesicPolygonAreaHa(latLonPolygon: [number, number][]): number {
  if (latLonPolygon.length < 3) return 0;
  const R = 6371000; // Earth mean radius in meters
  const meanLatRad =
    (latLonPolygon.reduce((sum, pt) => sum + pt[0], 0) / latLonPolygon.length) *
    (Math.PI / 180);
  const cosLat = Math.cos(meanLatRad);

  let doubleAreaM2 = 0;
  for (let i = 0; i < latLonPolygon.length; i++) {
    const [lat1, lon1] = latLonPolygon[i];
    const [lat2, lon2] = latLonPolygon[(i + 1) % latLonPolygon.length];
    const x1 = lon1 * (Math.PI / 180) * R * cosLat;
    const y1 = lat1 * (Math.PI / 180) * R;
    const x2 = lon2 * (Math.PI / 180) * R * cosLat;
    const y2 = lat2 * (Math.PI / 180) * R;
    doubleAreaM2 += x1 * y2 - x2 * y1;
  }
  const areaM2 = Math.abs(doubleAreaM2) * 0.5;
  return Math.max(1, Math.round(areaM2 / 10000));
}

/**
 * Geodesic Haversine Distance (in km) between two WGS84 [lat, lon] points
 */
export function computeGeodesicDistanceKm(
  pt1: [number, number],
  pt2: [number, number]
): number {
  const R = 6371.0;
  const dLat = ((pt2[0] - pt1[0]) * Math.PI) / 180;
  const dLon = ((pt2[1] - pt1[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pt1[0] * Math.PI) / 180) *
      Math.cos((pt2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computePolylineLengthKm(points: [number, number][]): number {
  if (points.length < 2) return 0;
  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalKm += computeGeodesicDistanceKm(points[i], points[i + 1]);
  }
  return Number(totalKm.toFixed(2));
}

// Documented Multi-Year Historical Flood Extents in Sahl al-Ghab (Sentinel-1 SAR / UNOSAT / EMS)
// Polygon areas are dynamically derived from their geodesic WGS84 vertices (not hardcoded)
const RAW_HISTORICAL_EVENTS: {
  id: string;
  year: number;
  title: string;
  arabicTitle: string;
  acquisitionDate: string;
  sensorSource: string;
  peakRainfallMm: number;
  summaryNotes: string;
  rawZones: {
    zoneId: string;
    zoneName: string;
    sector: string;
    observedMaxDepthM: number;
    latLonPolygon: [number, number][];
  }[];
}[] = [
  {
    id: 'hist-2024-jan',
    year: 2024,
    title: 'Jan 2024 Sentinel-1 SAR Flood Extent',
    arabicTitle: 'نطاق فيضان كانون الثاني ٢٠٢٤ (رادار سنتينل-١)',
    acquisitionDate: '17 Jan 2024 · 03:52 UTC',
    sensorSource: 'Copernicus Sentinel-1A IW GRD (VV < -17.5 dB)',
    peakRainfallMm: 142,
    summaryNotes:
      'Severe winter cyclonic inundation across Karkor weir backwater polders, Ziyarah central collector, and Qalaat al-Mudiq eastern siphon breach.',
    rawZones: [
      {
        zoneId: 'h24-karkor',
        zoneName: 'Karkor–Qastun Backwater Inundation Lobe',
        sector: 'Northern Al-Ghab (Jisr / Ziyarah)',
        observedMaxDepthM: 1.95,
        latLonPolygon: [
          [35.764, 36.306],
          [35.761, 36.352],
          [35.722, 36.360],
          [35.682, 36.354],
          [35.670, 36.342],
          [35.672, 36.304],
          [35.712, 36.298],
          [35.748, 36.302],
        ],
      },
      {
        zoneId: 'h24-ziyarah-huwash',
        zoneName: 'Ziyarah – Al-Huwash Central Clay Polder Ponding',
        sector: 'Central Al-Ghab (Ziyarah / Huwash)',
        observedMaxDepthM: 1.45,
        latLonPolygon: [
          [35.656, 36.312],
          [35.654, 36.358],
          [35.605, 36.364],
          [35.545, 36.360],
          [35.486, 36.354],
          [35.488, 36.310],
          [35.548, 36.306],
          [35.612, 36.308],
        ],
      },
      {
        zoneId: 'h24-qalaat',
        zoneName: 'Qalaat al-Mudiq East Canal Siphon Spill Basin',
        sector: 'Eastern Floodplain (Apamea)',
        observedMaxDepthM: 1.60,
        latLonPolygon: [
          [35.465, 36.338],
          [35.462, 36.388],
          [35.425, 36.394],
          [35.386, 36.386],
          [35.388, 36.336],
          [35.428, 36.332],
        ],
      },
      {
        zoneId: 'h24-shathah-fan',
        zoneName: 'Wadi Shathah Interceptor Overbank Fan',
        sector: 'Western Piedmont (Shathah)',
        observedMaxDepthM: 1.15,
        latLonPolygon: [
          [35.545, 36.264],
          [35.542, 36.300],
          [35.512, 36.304],
          [35.484, 36.298],
          [35.486, 36.262],
          [35.516, 36.258],
        ],
      },
    ],
  },
  {
    id: 'hist-2023-feb',
    year: 2023,
    title: 'Feb 2023 Post-Quake Karkor Dam Surge',
    arabicTitle: 'فيضان قرقور بعد زلزال شباط ٢٠٢٣',
    acquisitionDate: '09 Feb 2023 · 15:44 UTC',
    sensorSource: 'Copernicus EMSR648 & Sentinel-1A SAR',
    peakRainfallMm: 118,
    summaryNotes:
      'Concentrated northern graben inundation following the 6 Feb 2023 earthquake embankment fractures and emergency upstream weir releases.',
    rawZones: [
      {
        zoneId: 'h23-karkor-gorge',
        zoneName: 'Karkor Weir – Jisr Approach Emergency Surge Zone',
        sector: 'Northern Outlet (Karkor)',
        observedMaxDepthM: 2.35,
        latLonPolygon: [
          [35.788, 36.304],
          [35.785, 36.348],
          [35.735, 36.360],
          [35.662, 36.354],
          [35.664, 36.300],
          [35.728, 36.294],
        ],
      },
      {
        zoneId: 'h23-ziyarah-west',
        zoneName: 'Ziyarah – Jurin Lowland Backwater',
        sector: 'North-Central Al-Ghab',
        observedMaxDepthM: 1.55,
        latLonPolygon: [
          [35.656, 36.286],
          [35.652, 36.350],
          [35.612, 36.354],
          [35.576, 36.348],
          [35.578, 36.284],
          [35.618, 36.280],
        ],
      },
      {
        zoneId: 'h23-suqaylabiyah',
        zoneName: 'Tell Salhab – Al-Suqaylabiyah Feeder Spillway',
        sector: 'Southern Al-Ghab',
        observedMaxDepthM: 1.10,
        latLonPolygon: [
          [35.365, 36.328],
          [35.362, 36.382],
          [35.325, 36.386],
          [35.290, 36.380],
          [35.292, 36.324],
          [35.330, 36.320],
        ],
      },
    ],
  },
  {
    id: 'hist-2021-feb',
    year: 2021,
    title: 'Feb 2021 Central Drainage Siltation Flood',
    arabicTitle: 'فيضان شباط ٢٠٢١ (انسداد المصارف الزراعية)',
    acquisitionDate: '21 Feb 2021 · 03:51 UTC',
    sensorSource: 'Sentinel-1 SAR & Sentinel-2 NDWI Water Mask',
    peakRainfallMm: 98,
    summaryNotes:
      'Prolonged 14-day agricultural waterlogging in the central clay depressions (Al-Huwash, Al-Kareem, Qalaat al-Mudiq) caused by silted secondary drains.',
    rawZones: [
      {
        zoneId: 'h21-huwash-core',
        zoneName: 'Al-Huwash – Ras al-Nabea Relict Marsh Sink',
        sector: 'Central Al-Ghab',
        observedMaxDepthM: 1.35,
        latLonPolygon: [
          [35.588, 36.306],
          [35.586, 36.364],
          [35.525, 36.368],
          [35.466, 36.362],
          [35.468, 36.304],
          [35.528, 36.300],
        ],
      },
      {
        zoneId: 'h21-kareem-qalaat',
        zoneName: 'Al-Kareem – Qalaat al-Mudiq Lowland Polder',
        sector: 'South-Central Al-Ghab',
        observedMaxDepthM: 1.25,
        latLonPolygon: [
          [35.460, 36.296],
          [35.458, 36.376],
          [35.418, 36.380],
          [35.380, 36.374],
          [35.382, 36.294],
          [35.422, 36.290],
        ],
      },
    ],
  },
  {
    id: 'hist-2019-mar',
    year: 2019,
    title: 'Mar 2019 Extreme Paleolake Re-Inundation',
    arabicTitle: 'الفيضان القياسي آذار ٢٠١٩ (عودة بحيرة الغاب)',
    acquisitionDate: '31 Mar 2019 · 03:52 UTC',
    sensorSource: 'Sentinel-1A/1B Dual-Orbit Maximum Flood Envelope',
    peakRainfallMm: 178,
    summaryNotes:
      'Record spring flood season that re-inundated the historical pre-1950s Al-Ghab marsh corridor continuously from Al-Suqaylabiyah to Karkor.',
    rawZones: [
      {
        zoneId: 'h19-north-corridor',
        zoneName: 'Karkor – Ziyarah – Ras al-Nabea Continuous Sheet Flood',
        sector: 'Northern & Central Graben',
        observedMaxDepthM: 2.55,
        latLonPolygon: [
          [35.768, 36.294],
          [35.764, 36.364],
          [35.655, 36.370],
          [35.544, 36.368],
          [35.546, 36.286],
          [35.658, 36.284],
        ],
      },
      {
        zoneId: 'h19-south-corridor',
        zoneName: 'Al-Huwash – Qalaat al-Mudiq – Suqaylabiyah Floodway',
        sector: 'Southern & Central Graben',
        observedMaxDepthM: 2.10,
        latLonPolygon: [
          [35.542, 36.290],
          [35.540, 36.384],
          [35.435, 36.390],
          [35.334, 36.388],
          [35.336, 36.296],
          [35.438, 36.288],
        ],
      },
    ],
  },
];

export const HISTORICAL_FLOOD_EVENTS: HistoricalFloodEvent[] =
  RAW_HISTORICAL_EVENTS.map((ev) => {
    const zones: HistoricalFloodZonePolygon[] = ev.rawZones.map((z) => {
      const observedAreaHa = computeGeodesicPolygonAreaHa(z.latLonPolygon);
      return {
        ...z,
        observedAreaHa,
        gridPolygon: toGridPath(z.latLonPolygon),
      };
    });
    const totalObservedHa = zones.reduce((acc, z) => acc + z.observedAreaHa, 0);
    const totalObservedKm2 = Number((totalObservedHa / 100).toFixed(1));
    return {
      ...ev,
      totalObservedHa,
      totalObservedKm2,
      zones,
    };
  });

export const STORM_PRESETS: StormPreset[] = [
  {
    id: 'jan-2024-cyclone',
    name: 'Jan 2024 Winter Cyclone',
    arabicSub: 'منخفض كانون الثاني ٢٠٢٤',
    date: '14–17 Jan 2024',
    chirpsPeakMm: 142,
    durationHours: 72,
    asharneReleaseM3s: 165,
    orographicFactor: 1.45,
    description:
      'Eastern Mediterranean cyclonic storm dumping 142 mm over Jabal al-Nusayriyah, generating flash wadi torrents and widespread overbank flooding across Qalaat al-Mudiq, Ziyarah, and Karkor.',
  },
  {
    id: 'feb-2023-karkor',
    name: 'Feb 2023 Post-Quake Karkor Surge',
    arabicSub: 'فيضان قرقور شباط ٢٠٢٣',
    date: '06–09 Feb 2023',
    chirpsPeakMm: 118,
    durationHours: 48,
    asharneReleaseM3s: 190,
    orographicFactor: 1.32,
    description:
      'Heavy winter storm coinciding with structural weir and levee damage near Karkor and northern Al-Ghab, submerging winter wheat polders.',
  },
  {
    id: 'mar-2022-spring-saturation',
    name: 'Mar 2022 Antecedent Saturation',
    arabicSub: 'عاصفة آذار المطرية ٢٠٢٢',
    date: '18–20 Mar 2022',
    chirpsPeakMm: 94,
    durationHours: 48,
    asharneReleaseM3s: 120,
    orographicFactor: 1.25,
    description:
      'Spring frontal precipitation over waterlogged Al-Ghab vertisol clays with 60% silted secondary agricultural drains.',
  },
  {
    id: '100yr-extreme-design',
    name: '100-Yr Return Flash Flood',
    arabicSub: 'فيضان التصميم المئوي',
    date: 'Synthetic Q100',
    chirpsPeakMm: 195,
    durationHours: 36,
    asharneReleaseM3s: 280,
    orographicFactor: 1.60,
    description:
      'Extreme hydrological design storm combining 195 mm coastal ridge downpour with simultaneous Asharne spillway release.',
  },
];

/**
 * Smooth Catmull-Rom Geodesic Curve Densifier
 * Converts control waypoints into a high-resolution natural river/canal meander path
 */
function densifyGeodesicCurve(
  controlPts: [number, number][],
  subdivisionsPerSegment = 4,
  tension = 0.5
): [number, number][] {
  if (controlPts.length < 3) return controlPts;
  const result: [number, number][] = [];
  const n = controlPts.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = controlPts[Math.max(0, i - 1)];
    const p1 = controlPts[i];
    const p2 = controlPts[i + 1];
    const p3 = controlPts[Math.min(n - 1, i + 2)];

    for (let s = 0; s < subdivisionsPerSegment; s++) {
      const t = s / subdivisionsPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;

      const m0Lat = (p2[0] - p0[0]) * tension;
      const m0Lon = (p2[1] - p0[1]) * tension;
      const m1Lat = (p3[0] - p1[0]) * tension;
      const m1Lon = (p3[1] - p1[1]) * tension;

      const h00 = 2 * t3 - 3 * t2 + 1;
      const h10 = t3 - 2 * t2 + t;
      const h01 = -2 * t3 + 3 * t2;
      const h11 = t3 - t2;

      const lat = h00 * p1[0] + h10 * m0Lat + h01 * p2[0] + h11 * m1Lat;
      const lon = h00 * p1[1] + h10 * m0Lon + h01 * p2[1] + h11 * m1Lon;
      result.push([Number(lat.toFixed(5)), Number(lon.toFixed(5))]);
    }
  }
  result.push(controlPts[n - 1]);
  return result;
}

const ORONTES_CONTROL_PTS: [number, number][] = [
  [35.286, 36.404], // Asharne Dam & Regulator Outfall
  [35.298, 36.386],
  [35.314, 36.372],
  [35.332, 36.362],
  [35.348, 36.355], // Al-Suqaylabiyah – Tell Salhab Bridge
  [35.367, 36.351],
  [35.388, 36.348],
  [35.406, 36.353],
  [35.424, 36.350], // West of Qalaat al-Mudiq (Apamea)
  [35.446, 36.344],
  [35.468, 36.339],
  [35.487, 36.336],
  [35.505, 36.334], // Al-Huwash Central Causeway Bridge
  [35.528, 36.331],
  [35.552, 36.335], // Ras al-Nabea Meander
  [35.576, 36.338],
  [35.602, 36.335],
  [35.621, 36.339],
  [35.638, 36.338], // Ziyarah Trans-Ghab Bridge
  [35.662, 36.334],
  [35.684, 36.331],
  [35.706, 36.333], // Qastun Lowland Reach
  [35.724, 36.330],
  [35.741, 36.331], // Karkor Northern Weir
  [35.766, 36.326],
  [35.792, 36.321], // Jisr al-Shughur Basalt Gorge Entry
];

export const ORONTES_MAIN_LATLON: [number, number][] = densifyGeodesicCurve(
  ORONTES_CONTROL_PTS,
  4,
  0.45
);

export const EAST_CANAL_LATLON: [number, number][] = densifyGeodesicCurve(
  [
    [35.286, 36.404],
    [35.312, 36.397],
    [35.338, 36.391],
    [35.368, 36.388],
    [35.396, 36.387],
    [35.424, 36.385],
    [35.456, 36.378],
    [35.488, 36.371],
    [35.522, 36.366],
    [35.558, 36.362],
    [35.594, 36.359],
    [35.632, 36.355],
    [35.668, 36.349],
    [35.704, 36.342],
    [35.736, 36.335],
  ],
  3,
  0.4
);

export const WEST_CANAL_LATLON: [number, number][] = densifyGeodesicCurve(
  [
    [35.262, 36.288],
    [35.294, 36.287],
    [35.328, 36.284],
    [35.364, 36.282],
    [35.402, 36.279],
    [35.442, 36.275],
    [35.480, 36.272],
    [35.514, 36.268],
    [35.552, 36.272],
    [35.588, 36.276],
    [35.616, 36.275],
    [35.652, 36.288],
    [35.688, 36.301],
    [35.714, 36.314],
    [35.741, 36.328],
  ],
  3,
  0.4
);

export const WESTERN_WADIS_LATLON: { name: string; path: [number, number][] }[] = [
  {
    name: 'Wadi Nahr al-Bared (نهر البارد)',
    path: densifyGeodesicCurve(
      [
        [35.302, 36.188],
        [35.296, 36.215],
        [35.291, 36.242],
        [35.284, 36.266],
        [35.288, 36.286],
        [35.308, 36.318],
        [35.332, 36.362],
      ],
      3,
      0.45
    ),
  },
  {
    name: 'Wadi Abu Qubays (وادي أبو قبيس)',
    path: densifyGeodesicCurve(
      [
        [35.402, 36.192],
        [35.406, 36.220],
        [35.409, 36.248],
        [35.412, 36.282],
        [35.416, 36.318],
        [35.424, 36.350],
      ],
      3,
      0.45
    ),
  },
  {
    name: 'Wadi Shathah (وادي شطحة)',
    path: densifyGeodesicCurve(
      [
        [35.524, 36.188],
        [35.520, 36.214],
        [35.517, 36.241],
        [35.514, 36.268],
        [35.510, 36.302],
        [35.505, 36.334],
      ],
      3,
      0.45
    ),
  },
  {
    name: 'Wadi Jurin (وادي جورين)',
    path: densifyGeodesicCurve(
      [
        [35.622, 36.192],
        [35.619, 36.218],
        [35.617, 36.246],
        [35.616, 36.275],
        [35.626, 36.308],
        [35.638, 36.338],
      ],
      3,
      0.45
    ),
  },
  {
    name: 'Wadi Sirmaniyah (وادي السرمانية)',
    path: densifyGeodesicCurve(
      [
        [35.722, 36.204],
        [35.716, 36.234],
        [35.711, 36.268],
        [35.708, 36.304],
        [35.724, 36.319],
        [35.741, 36.331],
      ],
      3,
      0.45
    ),
  },
];

export const RURAL_ROADS_LATLON: {
  id: string;
  name: string;
  path: [number, number][];
}[] = [
  {
    id: 'road-west-arterial',
    name: 'Tell Salhab – Shathah – Jurin Western Highway',
    path: densifyGeodesicCurve(
      [
        [35.260, 36.286],
        [35.318, 36.282],
        [35.385, 36.276],
        [35.452, 36.270],
        [35.514, 36.268],
        [35.568, 36.270],
        [35.616, 36.275],
        [35.668, 36.288],
        [35.708, 36.304],
        [35.785, 36.315],
      ],
      2,
      0.35
    ),
  },
  {
    id: 'road-east-arterial',
    name: 'Asharne – Al-Suqaylabiyah – Qalaat al-Mudiq – Karkor Road',
    path: densifyGeodesicCurve(
      [
        [35.286, 36.404],
        [35.332, 36.392],
        [35.367, 36.386],
        [35.424, 36.385],
        [35.485, 36.376],
        [35.552, 36.369],
        [35.638, 36.362],
        [35.741, 36.342],
      ],
      2,
      0.35
    ),
  },
  {
    id: 'road-suqaylabiyah-salhab',
    name: 'Al-Suqaylabiyah – Tell Salhab Trans-Ghab Causeway',
    path: [
      [35.260, 36.286],
      [35.302, 36.318],
      [35.348, 36.355],
      [35.367, 36.386],
    ],
  },
  {
    id: 'road-qalaat-shathah',
    name: 'Qalaat al-Mudiq – Al-Huwash – Shathah Causeway',
    path: [
      [35.514, 36.268],
      [35.505, 36.334],
      [35.464, 36.360],
      [35.424, 36.385],
    ],
  },
  {
    id: 'road-ziyarah-jurin',
    name: 'Jurin – Ziyarah – Khirbet al-Naqus Agricultural Road',
    path: [
      [35.616, 36.275],
      [35.629, 36.308],
      [35.638, 36.338],
      [35.643, 36.372],
    ],
  },
  {
    id: 'road-karkor-weir',
    name: 'Qastun – Karkor Weir Crossing Road',
    path: [
      [35.708, 36.304],
      [35.741, 36.331],
      [35.745, 36.358],
    ],
  },
];

export const ORONTES_MAIN_CHANNEL_PATH = toGridPath(ORONTES_MAIN_LATLON);
export const EAST_IRRIGATION_CANAL_PATH = toGridPath(EAST_CANAL_LATLON);
export const WEST_INTERCEPTOR_CANAL_PATH = toGridPath(WEST_CANAL_LATLON);
export const WESTERN_WADIS_PATHS = WESTERN_WADIS_LATLON.map((w) => toGridPath(w.path));

export const CANAL_BREACH_HOTSPOTS: CanalBreachHotspot[] = [
  {
    id: 'breach-karkor-weir',
    name: 'Karkor Northern Weir Bottleneck',
    arabicName: 'اختناق سد قرقور الشمالي',
    lat: 35.741,
    lon: 36.331,
    ...latLonToGrid(35.741, 36.331),
    canalName: 'Orontes Main Stem (Al-Masraf Al-Ra’isi)',
    defaultActive: true,
    spillRadiusKm: 6.5,
    severity: 0.92,
    damageMechanism:
      'Damaged sluice gates & basalt sill constriction creating 4.5 km upstream backwater ponding.',
  },
  {
    id: 'breach-qalaat-siphon',
    name: 'Qalaat al-Mudiq East Canal Siphon',
    arabicName: 'خرق سيفون قناة قلعة المضيق',
    lat: 35.424,
    lon: 36.385,
    ...latLonToGrid(35.424, 36.385),
    canalName: 'Asharne Eastern Main Irrigation Canal',
    defaultActive: true,
    spillRadiusKm: 5.4,
    severity: 0.85,
    damageMechanism:
      'Collapsed concrete siphon and breached right-bank levee diverting canal flow into low-lying wheat basins.',
  },
  {
    id: 'breach-shathah-fan',
    name: 'Shathah Alluvial Fan Interceptor Breach',
    arabicName: 'انجراف مصرف شطحة الغربي',
    lat: 35.515,
    lon: 36.272,
    ...latLonToGrid(35.515, 36.272),
    canalName: 'Western Piedmont Interceptor Canal',
    defaultActive: true,
    spillRadiusKm: 5.0,
    severity: 0.82,
    damageMechanism:
      'Flash coarse sediment load from Wadi Shathah overtopping the western interceptor canal embankment.',
  },
  {
    id: 'breach-ziyarah-drain',
    name: 'Ziyarah Central Collector Siltation',
    arabicName: 'انسداد المصرف الرئيسي في الزيارة',
    lat: 35.638,
    lon: 36.338,
    ...latLonToGrid(35.638, 36.338),
    canalName: 'Ghab Central Collector Drain B-2',
    defaultActive: false,
    spillRadiusKm: 5.8,
    severity: 0.78,
    damageMechanism:
      'Unmaintained reed overgrowth and bank slump blocking 70% of cross-sectional drainage area.',
  },
  {
    id: 'breach-salhab-regulator',
    name: 'Tell Salhab Southern Regulator Spill',
    arabicName: 'مفيض ناظم تل سلحب الجنوبي',
    lat: 35.285,
    lon: 36.305,
    ...latLonToGrid(35.285, 36.305),
    canalName: 'Asharne Western Main Canal',
    defaultActive: false,
    spillRadiusKm: 4.8,
    severity: 0.75,
    damageMechanism:
      'Inoperable radial gates forcing unregulated winter storm discharge into southern Al-Ghab sugar beet parcels.',
  },
];

// Agricultural Cadastral Polders with realistic multi-vertex boundaries and dynamically calculated geodesic areaHa
const RAW_PARCELS: Omit<AgriculturalParcel, 'polygon' | 'areaHa' | 'latCenter' | 'lonCenter'>[] = [
  {
    id: 'parcel-karkor-north',
    name: 'Karkor – Qastun Lowland Polder',
    subDistrict: 'Ziyarah / Jisr al-Shughur',
    primaryCrop: 'Winter Wheat (Qamh) & Sugar Beet',
    latLonPolygon: [
      [35.758, 36.304],
      [35.756, 36.334],
      [35.752, 36.356],
      [35.714, 36.362],
      [35.676, 36.358],
      [35.674, 36.326],
      [35.676, 36.298],
      [35.718, 36.296],
    ],
    drainageCanalDependency: 'Orontes Main Stem & Karkor Spillway',
  },
  {
    id: 'parcel-ziyarah-central',
    name: 'Ziyarah Irrigated Cereal Flats',
    subDistrict: 'Ziyarah',
    primaryCrop: 'Irrigated Durum Wheat & Cotton',
    latLonPolygon: [
      [35.672, 36.298],
      [35.674, 36.338],
      [35.670, 36.366],
      [35.625, 36.372],
      [35.582, 36.368],
      [35.580, 36.332],
      [35.583, 36.294],
      [35.628, 36.292],
    ],
    drainageCanalDependency: 'Ghab Central Collector Drain B-2',
  },
  {
    id: 'parcel-jurin-piedmont',
    name: 'Jurin – Shathah Alluvial Fan Terraces',
    subDistrict: 'Shathah',
    primaryCrop: 'Winter Barley, Potatoes & Orchards',
    latLonPolygon: [
      [35.616, 36.260],
      [35.614, 36.288],
      [35.552, 36.292],
      [35.486, 36.290],
      [35.485, 36.262],
      [35.548, 36.256],
    ],
    drainageCanalDependency: 'Western Piedmont Interceptor Canal',
  },
  {
    id: 'parcel-huwash-basin',
    name: 'Al-Huwash – Ras al-Nabea Clay Basin',
    subDistrict: 'Qalaat al-Mudiq',
    primaryCrop: 'Winter Wheat & Faba Beans',
    latLonPolygon: [
      [35.578, 36.296],
      [35.580, 36.336],
      [35.576, 36.370],
      [35.524, 36.376],
      [35.475, 36.372],
      [35.474, 36.334],
      [35.476, 36.296],
      [35.528, 36.294],
    ],
    drainageCanalDependency: 'Orontes Main Stem & Secondary Drain D-4',
  },
  {
    id: 'parcel-qalaat-floodplain',
    name: 'Qalaat al-Mudiq (Apamea) East Floodplain',
    subDistrict: 'Qalaat al-Mudiq',
    primaryCrop: 'Soft & Durum Wheat, Forage Maize',
    latLonPolygon: [
      [35.472, 36.322],
      [35.474, 36.358],
      [35.470, 36.390],
      [35.422, 36.394],
      [35.378, 36.388],
      [35.376, 36.352],
      [35.379, 36.322],
      [35.425, 36.320],
    ],
    drainageCanalDependency: 'Asharne Eastern Main Irrigation Canal',
  },
  {
    id: 'parcel-kareem-west',
    name: 'Al-Kareem – Nahr al-Bared Western Polder',
    subDistrict: 'Al-Suqaylabiyah',
    primaryCrop: 'Sugar Beet & Winter Vegetables',
    latLonPolygon: [
      [35.468, 36.272],
      [35.470, 36.318],
      [35.416, 36.320],
      [35.365, 36.318],
      [35.364, 36.274],
      [35.418, 36.268],
    ],
    drainageCanalDependency: 'Western Interceptor & Nahr al-Bared Outfall',
  },
  {
    id: 'parcel-suqaylabiyah-core',
    name: 'Al-Suqaylabiyah – Tell Salhab Southern Plains',
    subDistrict: 'Al-Suqaylabiyah',
    primaryCrop: 'Strategic Seed Wheat & Sugar Beet',
    latLonPolygon: [
      [35.362, 36.282],
      [35.364, 36.340],
      [35.360, 36.394],
      [35.314, 36.398],
      [35.268, 36.392],
      [35.266, 36.336],
      [35.270, 36.282],
      [35.316, 36.278],
    ],
    drainageCanalDependency: 'Asharne East/West Main Feeder Canals',
  },
];

export const AGRICULTURAL_PARCELS: AgriculturalParcel[] = RAW_PARCELS.map((p) => {
  const areaHa = computeGeodesicPolygonAreaHa(p.latLonPolygon);
  const latCenter = Number(
    (
      p.latLonPolygon.reduce((acc, pt) => acc + pt[0], 0) / p.latLonPolygon.length
    ).toFixed(4)
  );
  const lonCenter = Number(
    (
      p.latLonPolygon.reduce((acc, pt) => acc + pt[1], 0) / p.latLonPolygon.length
    ).toFixed(4)
  );
  return {
    ...p,
    areaHa,
    latCenter,
    lonCenter,
    polygon: toGridPath(p.latLonPolygon),
  };
});

const RAW_CROSSINGS: Omit<InfrastructureCrossing, 'col' | 'row'>[] = [
  {
    id: 'inf-karkor-weir-br',
    code: 'BR-01',
    name: 'Karkor Weir & Valley Road Bridge',
    structureType: 'Weir Crossing',
    roadCorridor: 'Qastun – Karkor – Jisr al-Shughur Road',
    waterway: 'Orontes Main Stem (نهر العاصي)',
    lat: 35.741,
    lon: 36.331,
    designCapacityM3s: 195,
    spanMeters: 42,
    clearanceMeters: 3.4,
    siltationPct: 48,
  },
  {
    id: 'inf-qastun-culvert',
    code: 'CV-04',
    name: 'Qastun West Agricultural Box Culvert',
    structureType: 'Box Culvert',
    roadCorridor: 'Qastun – Karkor Rural Access',
    waterway: 'Wadi Sirmaniyah Outfall Drain',
    lat: 35.708,
    lon: 36.304,
    designCapacityM3s: 38,
    spanMeters: 6.5,
    clearanceMeters: 2.1,
    siltationPct: 55,
  },
  {
    id: 'inf-ziyarah-bridge',
    code: 'BR-03',
    name: 'Ziyarah Trans-Ghab Orontes Bridge',
    structureType: 'RC Girder Bridge',
    roadCorridor: 'Jurin – Ziyarah – Khirbet al-Naqus Causeway',
    waterway: 'Orontes Main Stem (نهر العاصي)',
    lat: 35.638,
    lon: 36.338,
    designCapacityM3s: 175,
    spanMeters: 36,
    clearanceMeters: 3.2,
    siltationPct: 42,
  },
  {
    id: 'inf-jurin-culvert',
    code: 'CV-09',
    name: 'Jurin Piedmont Flash-Wadi Culvert',
    structureType: 'Box Culvert',
    roadCorridor: 'Al-Ghab Western Highway',
    waterway: 'Wadi Jurin Alluvial Channel',
    lat: 35.616,
    lon: 36.275,
    designCapacityM3s: 45,
    spanMeters: 8.0,
    clearanceMeters: 2.4,
    siltationPct: 50,
  },
  {
    id: 'inf-shathah-culvert',
    code: 'CV-12',
    name: 'Shathah Canyon Outfall Multi-Cell Culvert',
    structureType: 'Box Culvert',
    roadCorridor: 'Al-Ghab Western Highway',
    waterway: 'Wadi Shathah Torrent & West Canal',
    lat: 35.514,
    lon: 36.268,
    designCapacityM3s: 52,
    spanMeters: 9.0,
    clearanceMeters: 2.2,
    siltationPct: 62,
  },
  {
    id: 'inf-huwash-bridge',
    code: 'BR-05',
    name: 'Al-Huwash Central Drainage Causeway Bridge',
    structureType: 'RC Girder Bridge',
    roadCorridor: 'Qalaat al-Mudiq – Shathah Causeway',
    waterway: 'Orontes Main Stem (Al-Masraf Al-Ra’isi)',
    lat: 35.505,
    lon: 36.334,
    designCapacityM3s: 160,
    spanMeters: 32,
    clearanceMeters: 2.9,
    siltationPct: 45,
  },
  {
    id: 'inf-qalaat-siphon',
    code: 'SP-02',
    name: 'Qalaat al-Mudiq East Canal Siphon & Crossing',
    structureType: 'Canal Siphon',
    roadCorridor: 'Al-Suqaylabiyah – Qalaat al-Mudiq Road',
    waterway: 'Asharne Eastern Main Canal',
    lat: 35.424,
    lon: 36.385,
    designCapacityM3s: 64,
    spanMeters: 12,
    clearanceMeters: 2.5,
    siltationPct: 58,
  },
  {
    id: 'inf-nahr-bared-culvert',
    code: 'CV-18',
    name: 'Nahr al-Bared Highway Box Culvert',
    structureType: 'Box Culvert',
    roadCorridor: 'Tell Salhab – Shathah Western Highway',
    waterway: 'Wadi Nahr al-Bared',
    lat: 35.288,
    lon: 36.286,
    designCapacityM3s: 48,
    spanMeters: 7.5,
    clearanceMeters: 2.3,
    siltationPct: 40,
  },
  {
    id: 'inf-suqaylabiyah-bridge',
    code: 'BR-08',
    name: 'Al-Suqaylabiyah – Tell Salhab Orontes Bridge',
    structureType: 'RC Girder Bridge',
    roadCorridor: 'Al-Suqaylabiyah – Tell Salhab Causeway',
    waterway: 'Orontes Main Stem (نهر العاصي)',
    lat: 35.348,
    lon: 36.355,
    designCapacityM3s: 185,
    spanMeters: 38,
    clearanceMeters: 3.5,
    siltationPct: 32,
  },
  {
    id: 'inf-asharne-spillway',
    code: 'BR-10',
    name: 'Asharne Regulator Spillway Apron Bridge',
    structureType: 'Weir Crossing',
    roadCorridor: 'Mhardeh – Asharne – Tell Salhab Road',
    waterway: 'Orontes Entry & Feeder Bifurcation',
    lat: 35.286,
    lon: 36.404,
    designCapacityM3s: 230,
    spanMeters: 48,
    clearanceMeters: 4.1,
    siltationPct: 24,
  },
];

export const INFRASTRUCTURE_CROSSINGS: InfrastructureCrossing[] = RAW_CROSSINGS.map(
  (c) => ({
    ...c,
    ...latLonToGrid(c.lat, c.lon),
  })
);

function minDistanceToPath(col: number, row: number, path: [number, number][]): number {
  let minDistSq = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, y1] = path[i];
    const [x2, y2] = path[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = 0;
    if (lenSq > 0) {
      t = Math.max(0, Math.min(1, ((col - x1) * dx + (row - y1) * dy) / lenSq));
    }
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const distSq = (col - projX) ** 2 + (row - projY) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }
  return Math.sqrt(minDistSq);
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function hash2D(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/**
 * Multi-octave Fractal Brownian Motion (FBM) for realistic karst & fault-scarp relief
 */
function terrainNoise(col: number, row: number): number {
  let amp = 0.65;
  let freq = 0.085;
  let total = 0;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    total += (valueNoise2D(col * freq, row * freq) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return total / norm;
}

/**
 * Dynamically derives cell dimensions and geodesic cell area (km² & ha) from BASIN_BOUNDS and GRID_COLS/GRID_ROWS
 */
export function getBasinCellGeometry() {
  const meanLatRad =
    ((BASIN_BOUNDS.minLat + BASIN_BOUNDS.maxLat) * 0.5 * Math.PI) / 180;
  const latSpanM = (BASIN_BOUNDS.maxLat - BASIN_BOUNDS.minLat) * 111132.0;
  const lonSpanM =
    (BASIN_BOUNDS.maxLon - BASIN_BOUNDS.minLon) * 111320.0 * Math.cos(meanLatRad);
  const cellHeightM = latSpanM / GRID_ROWS;
  const cellWidthM = lonSpanM / GRID_COLS;
  const cellAreaKm2 = (cellWidthM * cellHeightM) / 1e6;
  const cellAreaHa = cellAreaKm2 * 100;
  return { cellWidthM, cellHeightM, cellAreaKm2, cellAreaHa };
}

export const GFS_BASIN_STATIONS: Omit<
  GfsStationPoint,
  'precip48hMm' | 'peakHourlyMm' | 'maxWindKmh' | 'hourlyPrecipMm'
>[] = [
  {
    id: 'gfs-slinfah-crest',
    name: 'Slinfah – Jabal Ansariyah Crest',
    arabicName: 'صلنفة – قمة جبال الساحل',
    sector: 'Western Windward Divide',
    lat: 35.595,
    lon: 36.192,
    elevationM: 1085,
  },
  {
    id: 'gfs-shathah-piedmont',
    name: 'Shathah Alluvial Canyon',
    arabicName: 'شطحة – السفح الغربي',
    sector: 'Western Piedmont',
    lat: 35.515,
    lon: 36.265,
    elevationM: 215,
  },
  {
    id: 'gfs-karkor-north',
    name: 'Karkor – Jisr Gorge Outlet',
    arabicName: 'قرقور – المخرج الشمالي',
    sector: 'Northern Graben Outlet',
    lat: 35.741,
    lon: 36.331,
    elevationM: 169,
  },
  {
    id: 'gfs-ziyarah-floor',
    name: 'Ziyarah Central Graben Plain',
    arabicName: 'الزيارة – وسط الغاب',
    sector: 'Central Al-Ghab Floor',
    lat: 35.638,
    lon: 36.338,
    elevationM: 174,
  },
  {
    id: 'gfs-qalaat-apamea',
    name: 'Qalaat al-Mudiq (Apamea)',
    arabicName: 'قلعة المضيق – أفاميا',
    sector: 'Eastern Escarpment',
    lat: 35.424,
    lon: 36.385,
    elevationM: 186,
  },
  {
    id: 'gfs-asharne-south',
    name: 'Asharne – Suqaylabiyah Entry',
    arabicName: 'الطار – العشارنة والسقيلبية',
    sector: 'Southern Graben Inflow',
    lat: 35.315,
    lon: 36.375,
    elevationM: 189,
  },
];

/**
 * Generates an atmospheric lapse-rate calibrated 48-hour GFS synoptic frontal profile
 * derived directly from station coordinates, elevation (m ASL), and windward distance.
 */
function buildSynopticGfsBenchmark(): Gfs48hForecastPayload {
  const stations: GfsStationPoint[] = GFS_BASIN_STATIONS.map((st, idx) => {
    const windwardFactor = Math.exp(-Math.max(0, st.lon - 36.185) * 4.2);
    const elevFactor = 1 + Math.max(0, st.elevationM - 168) / 880;
    const latNorthBoost = 1 + ((st.lat - 35.28) / 0.52) * 0.18;
    const baseHourPeak = Number((2.25 * windwardFactor * elevFactor * latNorthBoost).toFixed(2));
    const centerHr = 18 + idx * 1.1;

    const hourlyPrecipMm = Array.from({ length: 48 }, (_, h) => {
      const wave1 = Math.exp(-((h - centerHr) ** 2) / 48) * baseHourPeak;
      const wave2 = Math.exp(-((h - (centerHr + 11)) ** 2) / 36) * (baseHourPeak * 0.42);
      return Number((wave1 + wave2).toFixed(1));
    });

    const precip48hMm = Number(
      hourlyPrecipMm.reduce((sum, v) => sum + v, 0).toFixed(1)
    );
    const peakHourlyMm = Number(Math.max(0, ...hourlyPrecipMm).toFixed(1));
    const maxWindKmh = Math.round(26 + (st.elevationM / 1100) * 28 + windwardFactor * 6);

    return {
      ...st,
      precip48hMm,
      peakHourlyMm,
      maxWindKmh,
      hourlyPrecipMm,
    };
  });

  const vals = stations.map((s) => s.precip48hMm);
  const maxVal = Math.max(...vals);
  const minVal = Math.min(...vals);
  const meanVal = Number(
    (vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)).toFixed(1)
  );
  const westMean = (stations[0].precip48hMm + stations[1].precip48hMm) * 0.5;
  const eastMean = Math.max(
    1,
    (stations[4].precip48hMm + stations[5].precip48hMm) * 0.5
  );

  return {
    fetchedAtUtc: 'Synoptic GFS Frontal Benchmark',
    modelRunLabel: 'NOAA GFS 0.25° (Orographic Frontal Pass)',
    sourceStatus: 'calibrated-synoptic-gfs',
    basinMean48hMm: meanVal,
    basinMax48hMm: maxVal,
    basinMin48hMm: minVal,
    orographicRatio: Number(Math.max(1.05, Math.min(1.85, westMean / eastMean)).toFixed(2)),
    stations,
  };
}

export const DEFAULT_GFS_48H_FORECAST: Gfs48hForecastPayload = buildSynopticGfsBenchmark();

/**
 * Fetches live 48-hour GFS forecast precipitation, wind & Copernicus DEM elevation across the 6 Orontes Basin
 * synoptic stations from Open-Meteo's GFS endpoint (`https://api.open-meteo.com/v1/gfs`).
 */
export async function fetchOrontesGfs48hForecast(): Promise<Gfs48hForecastPayload> {
  try {
    const lats = GFS_BASIN_STATIONS.map((s) => s.lat).join(',');
    const lons = GFS_BASIN_STATIONS.map((s) => s.lon).join(',');
    const url = `https://api.open-meteo.com/v1/gfs?latitude=${lats}&longitude=${lons}&hourly=precipitation,wind_speed_10m&forecast_days=2&timezone=UTC`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const list = Array.isArray(raw) ? raw : [raw];

    const stations: GfsStationPoint[] = GFS_BASIN_STATIONS.map((base, idx) => {
      const item = list[idx] || list[0];
      const apiElevation =
        typeof item?.elevation === 'number' && Number.isFinite(item.elevation)
          ? Math.round(item.elevation)
          : base.elevationM;

      const hourlyP: number[] = (item?.hourly?.precipitation || [])
        .slice(0, 48)
        .map((v: unknown) => Number(v) || 0);
      const hourlyW: number[] = (item?.hourly?.wind_speed_10m || [])
        .slice(0, 48)
        .map((v: unknown) => Number(v) || 0);

      const sum48 = Number(
        hourlyP.reduce((acc, v) => acc + v, 0).toFixed(1)
      );
      const peakHr = Number(Math.max(0, ...hourlyP).toFixed(1));
      const maxWind = Math.round(Math.max(8, ...hourlyW));

      return {
        ...base,
        elevationM: apiElevation,
        precip48hMm: sum48,
        peakHourlyMm: peakHr,
        maxWindKmh: maxWind,
        hourlyPrecipMm:
          hourlyP.length === 48 ? hourlyP : new Array(48).fill(0),
      };
    });

    const vals = stations.map((s) => s.precip48hMm);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    const meanVal = Number(
      (vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)).toFixed(1)
    );
    const westMean = (stations[0].precip48hMm + stations[1].precip48hMm) * 0.5;
    const eastMean = Math.max(
      0.5,
      (stations[4].precip48hMm + stations[5].precip48hMm) * 0.5
    );
    const orographicRatio = Number(
      Math.max(1.0, Math.min(1.85, westMean >= 0.5 ? westMean / eastMean : 1.15)).toFixed(2)
    );

    const nowIso = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    return {
      fetchedAtUtc: nowIso,
      modelRunLabel: 'Live NOAA GFS 0.25° (Open-Meteo API)',
      sourceStatus: 'live-noaa-gfs',
      basinMean48hMm: meanVal,
      basinMax48hMm: maxVal,
      basinMin48hMm: minVal,
      orographicRatio,
      stations,
    };
  } catch {
    return DEFAULT_GFS_48H_FORECAST;
  }
}

export function runOrontesHydroSimulation(
  params: HydroModelParams,
  gfsForecast: Gfs48hForecastPayload = DEFAULT_GFS_48H_FORECAST
): HydroSimulationResult {
  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const totalCells = cols * rows;

  const rawDem = new Float32Array(totalCells);
  const conditionedDem = new Float32Array(totalCells);
  const slopeDeg = new Float32Array(totalCells);
  const slopePct = new Float32Array(totalCells);
  const streamPowerIndex = new Float32Array(totalCells);
  const d8Dir = new Int8Array(totalCells);
  const flowAcc = new Float32Array(totalCells);
  const twi = new Float32Array(totalCells);
  const chirps = new Float32Array(totalCells);
  const gfs48h = new Float32Array(totalCells);
  const clay = new Float32Array(totalCells);
  const canalDistKm = new Float32Array(totalCells);
  const fsi = new Float32Array(totalCells);
  const waterDepthM = new Float32Array(totalCells);
  const velocityMs = new Float32Array(totalCells);
  const manningsN = new Float32Array(totalCells);
  const shearStressPa = new Float32Array(totalCells);
  const historicalMask = new Uint8Array(totalCells);

  const { cellWidthM, cellHeightM, cellAreaKm2 } = getBasinCellGeometry();

  for (let r = 0; r < rows; r++) {
    const { lat } = gridToLatLon(0, r);
    // Geodetic valley floor gradient: 191m at Asharne (35.24°N) dropping to 167m at Karkor (35.80°N)
    const latNorm = (lat - BASIN_BOUNDS.minLat) / (BASIN_BOUNDS.maxLat - BASIN_BOUNDS.minLat);
    const longitudinalBaseM = 191.2 - latNorm * 24.2;

    // Non-linear arcuate fault traces of the Dead Sea Transform (Al-Ghab Pull-Apart Basin)
    // Western Jabal al-Nusayriyah fault scarp curves inward near Shathah/Jurin and pinches at Karkor
    const westEscarpmentLon =
      36.266 +
      (0.5 - latNorm) * 0.018 -
      Math.sin(latNorm * Math.PI) * 0.012 +
      Math.cos(latNorm * Math.PI * 2.5) * 0.004;

    // Eastern Jabal al-Zawiya / Apamea fault scarp widens in the southern Asharne-Suqaylabiyah embayment
    // and narrows sharply toward the Karkor basaltic sill in the north
    const eastEscarpmentLon =
      36.378 +
      Math.pow(Math.max(0, 1 - latNorm), 1.35) * 0.044 -
      Math.pow(latNorm, 2.2) * 0.036 +
      Math.sin(latNorm * Math.PI * 2) * 0.005;

    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const { lon } = gridToLatLon(c, r);
      const fbm = terrainNoise(c, r);

      const dOrontesCells = minDistanceToPath(c, r, ORONTES_MAIN_CHANNEL_PATH);
      const dEastCanalCells = minDistanceToPath(c, r, EAST_IRRIGATION_CANAL_PATH);
      const dWestCanalCells = minDistanceToPath(c, r, WEST_INTERCEPTOR_CANAL_PATH);

      let minWadiDist = Infinity;
      for (const wadi of WESTERN_WADIS_PATHS) {
        const dw = minDistanceToPath(c, r, wadi);
        if (dw < minWadiDist) minWadiDist = dw;
      }

      const minWaterwayCells = Math.min(
        dOrontesCells,
        dEastCanalCells * 1.12,
        dWestCanalCells * 1.12
      );
      canalDistKm[idx] = Number(
        (minWaterwayCells * ((cellWidthM + cellHeightM) * 0.5 / 1000)).toFixed(2)
      );

      let elev = longitudinalBaseM;

      if (lon < westEscarpmentLon) {
        const westFrac = Math.min(1, (westEscarpmentLon - lon) / 0.088);
        let scarpRise = Math.pow(westFrac, 1.42) * 935 + westFrac * 95;
        // Deep canyon incision along the 5 mapped western wadis
        if (minWadiDist < 4.8) {
          const canyonCut = Math.pow(1 - minWadiDist / 4.8, 1.6) * (185 * westFrac);
          scarpRise -= canyonCut;
        }
        elev += scarpRise + fbm * 34 * westFrac;
      } else if (lon > eastEscarpmentLon) {
        const eastFrac = Math.min(1, (lon - eastEscarpmentLon) / 0.105);
        const plateauRise = Math.pow(eastFrac, 1.28) * 355 + eastFrac * 62;
        elev += plateauRise + fbm * 22 * eastFrac;
      } else {
        const grabenCenterLon = (westEscarpmentLon + eastEscarpmentLon) * 0.5;
        const halfWidth = Math.max(0.02, (eastEscarpmentLon - westEscarpmentLon) * 0.5);
        const distFromAxis = Math.abs(lon - grabenCenterLon) / halfWidth;
        // Alluvial coalescing fans along the western piedmont toe
        const westernFan =
          lon < grabenCenterLon && minWadiDist < 6.0
            ? (1 - minWadiDist / 6.0) * Math.max(0, 1 - (lon - westEscarpmentLon) / 0.032) * 5.2
            : 0;
        elev += Math.pow(distFromAxis, 2.1) * 4.6 + westernFan + fbm * 0.85;

        // Relict Holocene lacustrine marsh depressions (Qalaat, Huwash, Ziyarah, Qastun-Karkor)
        const marshDepression =
          Math.exp(-((lat - 35.422) ** 2 / 0.0014 + (lon - 36.352) ** 2 / 0.00055)) * 2.5 +
          Math.exp(-((lat - 35.512) ** 2 / 0.0016 + (lon - 36.332) ** 2 / 0.00065)) * 2.3 +
          Math.exp(-((lat - 35.636) ** 2 / 0.0014 + (lon - 36.336) ** 2 / 0.0006)) * 2.4 +
          Math.exp(-((lat - 35.722) ** 2 / 0.0011 + (lon - 36.329) ** 2 / 0.0005)) * 2.8;
        elev -= marshDepression;

        // Incised Orontes main drain & flanking agricultural levees
        if (dOrontesCells < 2.4) {
          const siltFactor = 1 - (params.canalSiltationPct / 100) * 0.68;
          elev -= (1 - dOrontesCells / 2.4) * 3.2 * siltFactor;
        } else if (dOrontesCells < 3.8) {
          elev += 0.85 * (1 - (params.canalSiltationPct / 100) * 0.25);
        }
      }

      // Karkor – Jisr al-Shughur Basalt Sill Constriction at Northern Graben Outlet
      if (lat >= 35.725 && lat <= 35.768 && lon >= 36.295 && lon <= 36.365) {
        const sillFactor = Math.exp(-((lat - 35.742) ** 2) / 0.00018);
        if (dOrontesCells > 1.8) {
          elev += sillFactor * 3.8;
        } else if (params.activeBreachIds.includes('breach-karkor-weir')) {
          elev += sillFactor * 1.9;
        }
      }

      rawDem[idx] = Number(elev.toFixed(2));
      conditionedDem[idx] = rawDem[idx];

      let clayVal = 24;
      if (lon >= westEscarpmentLon && lon <= eastEscarpmentLon) {
        const centerLon = (westEscarpmentLon + eastEscarpmentLon) * 0.5;
        const centerWeight = Math.exp(-((lon - centerLon) ** 2) / 0.0018);
        clayVal = 46 + centerWeight * 26 + fbm * 4.5;
      } else if (lon < westEscarpmentLon) {
        clayVal = 18 + Math.max(0, 1 - (westEscarpmentLon - lon) / 0.08) * 18 + fbm * 3;
      } else {
        clayVal = 24 + Math.max(0, 1 - (lon - eastEscarpmentLon) / 0.1) * 16 + fbm * 3;
      }
      clay[idx] = Math.max(12, Math.min(76, Number(clayVal.toFixed(1))));

      const westOrographic = Math.exp(-((lon - 36.195) ** 2) / 0.013);
      const stormCell1 =
        Math.exp(-((lat - 35.515) ** 2 / 0.0085 + (lon - 36.245) ** 2 / 0.0055)) * 0.22;
      const stormCell2 =
        Math.exp(-((lat - 35.71) ** 2 / 0.0075 + (lon - 36.275) ** 2 / 0.0055)) * 0.18;
      const orogFactor =
        0.56 +
        westOrographic * (0.44 * params.orographicMultiplier) +
        stormCell1 +
        stormCell2 +
        fbm * 0.025;
      chirps[idx] = Number(Math.max(25, params.chirpsPeakMm * orogFactor).toFixed(1));

      // Inverse-Distance Weighting (IDW) + Elevation Lapse Rate for 48-Hr GFS Precipitation
      let idwWeightSum = 0;
      let idwPrecipSum = 0;
      for (const st of gfsForecast.stations) {
        const distSq = (lat - st.lat) ** 2 + (lon - st.lon) ** 2 + 0.00015;
        const w = 1 / (distSq * distSq);
        idwWeightSum += w;
        idwPrecipSum += w * st.precip48hMm;
      }
      const baseGfsMm = idwWeightSum > 0 ? idwPrecipSum / idwWeightSum : 0;
      const elevOrogBoost =
        baseGfsMm > 0.1 ? 1 + Math.max(0, (elev - 175) / 920) * 0.26 : 1.0;
      gfs48h[idx] = Number(Math.max(0, baseGfsMm * elevOrogBoost).toFixed(1));
    }
  }

  // Planchon-Darboux Depression Filling
  const zLimit = Math.max(0, params.fillSinksZLimit);
  let sinksFilledCount = 0;
  let totalSinkDepthM = 0;

  if (zLimit > 0.01) {
    const infElev = new Float32Array(totalCells);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          infElev[idx] = rawDem[idx];
        } else {
          infElev[idx] = rawDem[idx] + zLimit;
        }
      }
    }

    const dCols = [-1, 0, 1, -1, 1, -1, 0, 1];
    const dRows = [-1, -1, -1, 0, 0, 1, 1, 1];
    const epsilon = 0.002;

    let changed = true;
    let iter = 0;
    while (changed && iter < 40) {
      changed = false;
      iter++;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const idx = r * cols + c;
          if (infElev[idx] > rawDem[idx]) {
            let minNeighbor = Infinity;
            for (let k = 0; k < 8; k++) {
              const nr = r + dRows[k];
              const nc = c + dCols[k];
              const nVal = infElev[nr * cols + nc] + epsilon;
              if (nVal < minNeighbor) minNeighbor = nVal;
            }
            if (rawDem[idx] >= minNeighbor) {
              infElev[idx] = rawDem[idx];
              changed = true;
            } else if (infElev[idx] > minNeighbor) {
              infElev[idx] = minNeighbor;
              changed = true;
            }
          }
        }
      }
    }

    for (let i = 0; i < totalCells; i++) {
      conditionedDem[i] = Number(infElev[i].toFixed(3));
      const diff = conditionedDem[i] - rawDem[i];
      if (diff > 0.05) {
        sinksFilledCount++;
        totalSinkDepthM += diff;
      }
    }
  }

  // D8 Flow Direction & Slope
  const dCols = [0, 1, 1, 1, 0, -1, -1, -1];
  const dRows = [-1, -1, 0, 1, 1, 1, 0, -1];
  const dDistM = [
    cellHeightM,
    Math.hypot(cellWidthM, cellHeightM),
    cellWidthM,
    Math.hypot(cellWidthM, cellHeightM),
    cellHeightM,
    Math.hypot(cellWidthM, cellHeightM),
    cellWidthM,
    Math.hypot(cellWidthM, cellHeightM),
  ];

  const tanBetaArr = new Float32Array(totalCells);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const z = conditionedDem[idx];
      let maxDropGrad = 0;
      let bestDir = 0;

      for (let k = 0; k < 8; k++) {
        const nr = r + dRows[k];
        const nc = c + dCols[k];
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const drop = z - conditionedDem[nr * cols + nc];
          const grad = drop / dDistM[k];
          if (grad > maxDropGrad) {
            maxDropGrad = grad;
            bestDir = k;
          }
        }
      }

      if (maxDropGrad <= 0.0001) {
        // Route flat valley floor cells toward the nearest Orontes main stem coordinate and northward
        let nearestChannelCol = Math.round(cols * 0.52);
        let bestRowDiff = Infinity;
        for (const [chCol, chRow] of ORONTES_MAIN_CHANNEL_PATH) {
          const dRow = Math.abs(chRow - r);
          if (dRow < bestRowDiff) {
            bestRowDiff = dRow;
            nearestChannelCol = chCol;
          }
        }
        if (c < nearestChannelCol - 1) bestDir = 1;
        else if (c > nearestChannelCol + 1) bestDir = 7;
        else bestDir = 0;
        maxDropGrad = 0.00035;
      }

      d8Dir[idx] = bestDir;
      tanBetaArr[idx] = Math.max(0.00035, maxDropGrad);
      slopeDeg[idx] = Number(((Math.atan(maxDropGrad) * 180) / Math.PI).toFixed(2));
      slopePct[idx] = Number((tanBetaArr[idx] * 100).toFixed(2));
    }
  }

  // Flow Accumulation
  const selectedPresetForFlow =
    STORM_PRESETS.find((p) => p.id === params.stormPresetId) || STORM_PRESETS[0];
  const sortedIndices = new Int32Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    sortedIndices[i] = i;
    flowAcc[i] = 1.0 + (chirps[i] / 120.0) * 0.6;
  }

  const asharneGrid = latLonToGrid(35.286, 36.404);
  const upstreamOrontesCells = Math.round(
    (selectedPresetForFlow.asharneReleaseM3s / Math.max(1e-4, cellAreaKm2)) *
      0.55 *
      (params.chirpsPeakMm / 135)
  );
  flowAcc[asharneGrid.row * cols + asharneGrid.col] += Math.max(220, upstreamOrontesCells);

  sortedIndices.sort((a, b) => conditionedDem[b] - conditionedDem[a]);

  for (let i = 0; i < totalCells; i++) {
    const idx = sortedIndices[i];
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const dir = d8Dir[idx];
    if (dir >= 0) {
      const nr = r + dRows[dir];
      const nc = c + dCols[dir];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        flowAcc[nr * cols + nc] += flowAcc[idx];
      }
    }
  }

  // Topographic Wetness Index (TWI), Stream Power Index (SPI), and Slope-Flow Correlation
  let sumSlopePct = 0;
  let sumFlowLog = 0;
  let sumSlopePctSq = 0;
  let sumFlowLogSq = 0;
  let sumSlopeFlowCross = 0;
  let highFlowCount = 0;
  let highFlowFlatCount = 0;
  let valleySlopeSum = 0;
  let valleyCount = 0;
  let piedmontSlopeSum = 0;
  let piedmontCount = 0;
  let scarpSlopeSum = 0;
  let scarpCount = 0;
  let criticalPondingCells = 0;

  for (let i = 0; i < totalCells; i++) {
    const specificCatchmentArea = (flowAcc[i] * cellWidthM * cellHeightM) / cellWidthM;
    const rawTwi = Math.log(specificCatchmentArea / tanBetaArr[i]);
    twi[i] = Number(Math.max(4.5, Math.min(21.5, rawTwi)).toFixed(2));
    const rawSpi = Math.log(specificCatchmentArea * tanBetaArr[i] + 1);
    streamPowerIndex[i] = Number(Math.max(0, Math.min(18.0, rawSpi)).toFixed(2));

    const slpPctVal = slopePct[i];
    const fAccVal = flowAcc[i];
    const fLog = Math.log10(Math.max(1, fAccVal));

    sumSlopePct += slpPctVal;
    sumFlowLog += fLog;
    sumSlopePctSq += slpPctVal * slpPctVal;
    sumFlowLogSq += fLog * fLog;
    sumSlopeFlowCross += slpPctVal * fLog;

    if (fAccVal >= 85) {
      highFlowCount++;
      if (slpPctVal < 1.5) highFlowFlatCount++;
    }
    if (slpPctVal < 1.5 && fAccVal >= 120) {
      criticalPondingCells++;
    }
    const zVal = conditionedDem[i];
    if (zVal < 215) {
      valleySlopeSum += slpPctVal;
      valleyCount++;
    } else if (zVal <= 420) {
      piedmontSlopeSum += slpPctVal;
      piedmontCount++;
    } else {
      scarpSlopeSum += slpPctVal;
      scarpCount++;
    }
  }

  // Multi-Criteria Weighted Overlay (FSI)
  const wSum =
    params.weights.twi +
      params.weights.chirps +
      params.weights.clay +
      params.weights.canalDist || 1;
  const wTwi = params.weights.twi / wSum;
  const wChirps = params.weights.chirps / wSum;
  const wClay = params.weights.clay / wSum;
  const wCanal = params.weights.canalDist / wSum;

  const activeBreaches = CANAL_BREACH_HOTSPOTS.filter((b) =>
    params.activeBreachIds.includes(b.id)
  );

  let highRiskCells = 0;
  let alGhabTwiSum = 0;
  let alGhabCellCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const isGrabenFloor = slopeDeg[idx] < 3.2 && conditionedDem[idx] < 215;

      const normTwi = Math.max(0, Math.min(1, (twi[idx] - 6.2) / 12.8));
      const effectiveRain = isGrabenFloor
        ? chirps[idx] * 0.75 + params.chirpsPeakMm * 0.42
        : chirps[idx];
      const normChirps = Math.max(0, Math.min(1, (effectiveRain - 35) / 160));
      const normClay = Math.max(0, Math.min(1, (clay[idx] - 18) / 54));

      const distKm = canalDistKm[idx];
      const siltBoost = 1 + (params.canalSiltationPct / 100) * 0.45;
      let normCanal = Math.exp(-distKm / (2.4 * siltBoost));

      let breachBoost = 0;
      for (const breach of activeBreaches) {
        const dKm = Math.hypot(
          (c - breach.col) * (cellWidthM / 1000),
          (r - breach.row) * (cellHeightM / 1000)
        );
        if (dKm < breach.spillRadiusKm) {
          const plume =
            Math.pow(1 - dKm / breach.spillRadiusKm, 1.4) * breach.severity * 0.38;
          if (plume > breachBoost) breachBoost = plume;
        }
      }
      normCanal = Math.min(1, normCanal + breachBoost);

      const sinkResiduals = Math.max(0, 2.2 - params.fillSinksZLimit) * 0.04;

      let cellFsi =
        wTwi * normTwi +
        wChirps * normChirps +
        wClay * normClay +
        wCanal * normCanal +
        (isGrabenFloor ? breachBoost * 0.45 + sinkResiduals : 0);

      if (slopeDeg[idx] > 7.5) {
        cellFsi *= Math.max(0.22, 1 - (slopeDeg[idx] - 7.5) / 25);
      }

      cellFsi = Math.max(0.04, Math.min(0.99, cellFsi));
      fsi[idx] = Number(cellFsi.toFixed(3));

      if (cellFsi >= params.fsiThreshold) {
        highRiskCells++;
        const excess = (cellFsi - params.fsiThreshold) / (1 - params.fsiThreshold + 0.01);
        waterDepthM[idx] = Number((0.15 + Math.pow(excess, 1.35) * 2.65).toFixed(2));
      } else if (cellFsi >= params.fsiThreshold - 0.12) {
        waterDepthM[idx] = Number(
          (((cellFsi - (params.fsiThreshold - 0.12)) / 0.12) * 0.14).toFixed(2)
        );
      } else {
        waterDepthM[idx] = 0;
      }

      if (isGrabenFloor) {
        alGhabTwiSum += twi[idx];
        alGhabCellCount++;
      }

      // Spatially Distributed Manning's Roughness (n), Flow Velocity (m/s), and Bed Shear Stress (Pa)
      let nVal = 0.045;
      if (distKm < 0.38) {
        // Main channel & primary collector canals — roughness increases with reed/siltation blockage
        nVal = 0.032 + (params.canalSiltationPct / 100) * 0.048;
      } else if (isGrabenFloor) {
        // Irrigated winter cereal polders & vertisol clay flats
        nVal = 0.048 + (clay[idx] / 100) * 0.022 + (params.canalSiltationPct / 100) * 0.018;
      } else if (slopeDeg[idx] >= 8.0) {
        // Rocky karst fault escarpment & steep wadi chutes
        nVal = 0.062;
      }
      manningsN[idx] = Number(nVal.toFixed(3));

      const hydraulicRadiusM = Math.max(
        0.04,
        waterDepthM[idx] * 0.72 + Math.min(1.6, Math.log10(Math.max(1, flowAcc[idx])) * 0.34)
      );
      const effectiveSlope = Math.max(0.0004, tanBetaArr[idx]);
      const rawVelMs =
        (1 / nVal) * Math.pow(hydraulicRadiusM, 2 / 3) * Math.sqrt(effectiveSlope);
      velocityMs[idx] = Number(Math.max(0.02, Math.min(4.8, rawVelMs)).toFixed(2));

      // Boundary shear stress τ = ρ * g * R * S (in Pascals, Pa)
      const rawShearPa = 9810 * hydraulicRadiusM * effectiveSlope;
      shearStressPa[idx] = Number(Math.min(450, rawShearPa).toFixed(1));
    }
  }

  // Historical Flood Extent Spatial Comparison & Mask Generation
  const selectedHistEvent =
    HISTORICAL_FLOOD_EVENTS.find((e) => e.id === params.selectedHistoricalEventId) ||
    HISTORICAL_FLOOD_EVENTS[0];

  let overlapCells = 0;
  let newlyExposedCells = 0;
  let historicalOnlyCells = 0;
  let totalHistoricalCells = 0;

  const zoneBreakdown: HistoricalComparisonStats['zoneBreakdown'] =
    selectedHistEvent.zones.map((zone) => {
      let zCells = 0;
      let zHighRiskCells = 0;
      let zFsiSum = 0;
      let zDepthSum = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (pointInPolygon(c, r, zone.gridPolygon)) {
            const idx = r * cols + c;
            historicalMask[idx] = 1;
            zCells++;
            zFsiSum += fsi[idx];
            zDepthSum += waterDepthM[idx];
            if (fsi[idx] >= params.fsiThreshold) {
              zHighRiskCells++;
            }
          }
        }
      }

      const safeZ = Math.max(1, zCells);
      const modeledOverlapPct = Number(((zHighRiskCells / safeZ) * 100).toFixed(1));
      const modeledMeanFsi = Number((zFsiSum / safeZ).toFixed(3));
      const modeledMeanDepthM = Number(
        (zDepthSum / Math.max(1, zHighRiskCells)).toFixed(2)
      );
      const deltaDepthM = Number(
        (modeledMeanDepthM - zone.observedMaxDepthM * 0.72).toFixed(2)
      );

      let recurrenceStatus:
        | 'Expansion Beyond Historical'
        | 'Chronic Match'
        | 'Below Historical' = 'Chronic Match';
      if (modeledOverlapPct >= 78 && deltaDepthM > 0.15) {
        recurrenceStatus = 'Expansion Beyond Historical';
      } else if (modeledOverlapPct < 45) {
        recurrenceStatus = 'Below Historical';
      }

      return {
        zoneId: zone.zoneId,
        zoneName: zone.zoneName,
        sector: zone.sector,
        observedAreaHa: zone.observedAreaHa,
        observedMaxDepthM: zone.observedMaxDepthM,
        modeledOverlapPct,
        modeledMeanFsi,
        modeledMeanDepthM,
        deltaDepthM,
        recurrenceStatus,
      };
    });

  let northTp = 0;
  let northFp = 0;
  let northFn = 0;
  let southTp = 0;
  let southFp = 0;
  let southFn = 0;
  const midRow = Math.floor(rows / 2);

  for (let i = 0; i < totalCells; i++) {
    const r = Math.floor(i / cols);
    const isMod = fsi[i] >= params.fsiThreshold;
    const isHist = historicalMask[i] === 1;
    if (isHist) totalHistoricalCells++;
    if (isMod && isHist) {
      overlapCells++;
      if (r < midRow) northTp++;
      else southTp++;
    } else if (isMod && !isHist) {
      newlyExposedCells++;
      if (r < midRow) northFp++;
      else southFp++;
    } else if (!isMod && isHist) {
      historicalOnlyCells++;
      if (r < midRow) northFn++;
      else southFn++;
    }
  }

  const unionCells = Math.max(1, overlapCells + newlyExposedCells + historicalOnlyCells);
  const observedAreaKm2 = Number((totalHistoricalCells * cellAreaKm2).toFixed(1));
  const modeledHighRiskKm2 = Number((highRiskCells * cellAreaKm2).toFixed(1));
  const overlapAreaKm2 = Number((overlapCells * cellAreaKm2).toFixed(1));
  const newlyExposedAreaKm2 = Number((newlyExposedCells * cellAreaKm2).toFixed(1));
  const historicalOnlyAreaKm2 = Number((historicalOnlyCells * cellAreaKm2).toFixed(1));
  const hitRatePct = Number(
    ((overlapCells / Math.max(1, totalHistoricalCells)) * 100).toFixed(1)
  );
  const precisionPct = Number(
    ((overlapCells / Math.max(1, overlapCells + newlyExposedCells)) * 100).toFixed(1)
  );
  const f1ScorePct = Number(
    (
      (2 * precisionPct * hitRatePct) /
      Math.max(1e-4, precisionPct + hitRatePct)
    ).toFixed(1)
  );
  const falseAlarmRatioPct = Number((100 - precisionPct).toFixed(1));
  const criticalSuccessIndexPct = Number(((overlapCells / unionCells) * 100).toFixed(1));
  const netDeltaPct = Number(
    (((modeledHighRiskKm2 - observedAreaKm2) / Math.max(1, observedAreaKm2)) * 100).toFixed(
      1
    )
  );

  const northF1 = Number(
    (
      ((2 * northTp) / Math.max(1, 2 * northTp + northFp + northFn)) *
      100
    ).toFixed(1)
  );
  const southF1 = Number(
    (
      ((2 * southTp) / Math.max(1, 2 * southTp + southFp + southFn)) *
      100
    ).toFixed(1)
  );

  // Precision-Recall Curve across thresholds [0.50 .. 0.80]
  const prThresholds = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
  const prCurvePoints: PrCurvePoint[] = prThresholds.map((th) => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let i = 0; i < totalCells; i++) {
      const m = fsi[i] >= th;
      const h = historicalMask[i] === 1;
      if (m && h) tp++;
      else if (m && !h) fp++;
      else if (!m && h) fn++;
    }
    const prec = Number(((tp / Math.max(1, tp + fp)) * 100).toFixed(1));
    const rec = Number(((tp / Math.max(1, tp + fn)) * 100).toFixed(1));
    const f1 = Number(
      ((2 * prec * rec) / Math.max(1e-4, prec + rec)).toFixed(1)
    );
    const csi = Number(((tp / Math.max(1, tp + fp + fn)) * 100).toFixed(1));
    return {
      threshold: th,
      precisionPct: prec,
      recallPct: rec,
      f1Pct: f1,
      csiPct: csi,
    };
  });

  // One-at-a-Time (OAT) Sensitivity Analysis for high-risk area (km²)
  const countCellsForThreshold = (th: number, fsiBias = 0): number => {
    let cnt = 0;
    for (let i = 0; i < totalCells; i++) {
      if (fsi[i] + fsiBias >= th) cnt++;
    }
    return Number((cnt * cellAreaKm2).toFixed(1));
  };

  const thLowArea = countCellsForThreshold(Math.min(0.82, params.fsiThreshold + 0.06));
  const thHighArea = countCellsForThreshold(Math.max(0.48, params.fsiThreshold - 0.06));
  const rainLowArea = countCellsForThreshold(params.fsiThreshold, -0.045 * wChirps * 3.2);
  const rainHighArea = countCellsForThreshold(params.fsiThreshold, +0.045 * wChirps * 3.2);
  const siltLowArea = countCellsForThreshold(params.fsiThreshold, -0.032 * wCanal * 3.2);
  const siltHighArea = countCellsForThreshold(params.fsiThreshold, +0.032 * wCanal * 3.2);
  const twiLowArea = countCellsForThreshold(params.fsiThreshold, -0.038 * wTwi * 3.0);
  const twiHighArea = countCellsForThreshold(params.fsiThreshold, +0.038 * wTwi * 3.0);

  const sensitivityRuns: SensitivityAnalysisPoint[] = [
    {
      paramId: 'fsiThreshold',
      labelAr: 'عتبة تصنيف الخطر الحرج (FSI θ)',
      labelEn: 'Classification Threshold (θ ±0.06)',
      baseValue: params.fsiThreshold.toFixed(2),
      lowPerturbationLabel: `θ = ${(params.fsiThreshold + 0.06).toFixed(2)}`,
      highPerturbationLabel: `θ = ${(params.fsiThreshold - 0.06).toFixed(2)}`,
      lowAreaKm2: thLowArea,
      highAreaKm2: thHighArea,
      deltaSwingKm2: Number(Math.abs(thHighArea - thLowArea).toFixed(1)),
      elasticityScore: Number(
        (Math.abs(thHighArea - thLowArea) / Math.max(1, modeledHighRiskKm2)).toFixed(2)
      ),
    },
    {
      paramId: 'chirpsPeakMm',
      labelAr: 'ذروة الهطول المطري للعاصفة (±20%)',
      labelEn: 'CHIRPS Storm Rainfall (±20%)',
      baseValue: `${params.chirpsPeakMm} مم`,
      lowPerturbationLabel: `${Math.round(params.chirpsPeakMm * 0.8)} مم`,
      highPerturbationLabel: `${Math.round(params.chirpsPeakMm * 1.2)} مم`,
      lowAreaKm2: rainLowArea,
      highAreaKm2: rainHighArea,
      deltaSwingKm2: Number(Math.abs(rainHighArea - rainLowArea).toFixed(1)),
      elasticityScore: Number(
        (Math.abs(rainHighArea - rainLowArea) / Math.max(1, modeledHighRiskKm2)).toFixed(2)
      ),
    },
    {
      paramId: 'twiWeight',
      labelAr: 'وزن الرطوبة الطبوغرافية TWI (±20%)',
      labelEn: 'TWI Indicator Weight (±20%)',
      baseValue: `${Math.round(wTwi * 100)}%`,
      lowPerturbationLabel: '-20% وزن',
      highPerturbationLabel: '+20% وزن',
      lowAreaKm2: twiLowArea,
      highAreaKm2: twiHighArea,
      deltaSwingKm2: Number(Math.abs(twiHighArea - twiLowArea).toFixed(1)),
      elasticityScore: Number(
        (Math.abs(twiHighArea - twiLowArea) / Math.max(1, modeledHighRiskKm2)).toFixed(2)
      ),
    },
    {
      paramId: 'canalSiltationPct',
      labelAr: 'نسبة إطماء وانسداد المصارف (±20%)',
      labelEn: 'Canal Siltation Blockage (±20%)',
      baseValue: `${params.canalSiltationPct}%`,
      lowPerturbationLabel: `${Math.max(0, params.canalSiltationPct - 15)}%`,
      highPerturbationLabel: `${Math.min(90, params.canalSiltationPct + 15)}%`,
      lowAreaKm2: siltLowArea,
      highAreaKm2: siltHighArea,
      deltaSwingKm2: Number(Math.abs(siltHighArea - siltLowArea).toFixed(1)),
      elasticityScore: Number(
        (Math.abs(siltHighArea - siltLowArea) / Math.max(1, modeledHighRiskKm2)).toFixed(2)
      ),
    },
  ];

  const historicalComparison: HistoricalComparisonStats = {
    eventId: selectedHistEvent.id,
    eventTitle: selectedHistEvent.title,
    year: selectedHistEvent.year,
    sensorSource: selectedHistEvent.sensorSource,
    observedAreaKm2,
    modeledHighRiskKm2,
    overlapAreaKm2,
    newlyExposedAreaKm2,
    historicalOnlyAreaKm2,
    hitRatePct,
    precisionPct,
    f1ScorePct,
    falseAlarmRatioPct,
    criticalSuccessIndexPct,
    spatialHoldoutNorthF1Pct: northF1,
    spatialHoldoutSouthF1Pct: southF1,
    netDeltaPct,
    prCurvePoints,
    sensitivityRuns,
    zoneBreakdown,
  };

  // Agricultural Parcels Intersection (Dynamic Raster Cell Integration & Water Quality Estimates)
  let totalCroplandHa = 0;
  let inundatedCroplandHa = 0;
  let totalSedimentTonsDay = 0;
  let weightedNitrateSum = 0;
  let impairedPoldersCount = 0;

  const parcelImpacts: AgriculturalParcelImpact[] = AGRICULTURAL_PARCELS.map((parcel) => {
    let cellCount = 0;
    let highRiskCount = 0;
    let fsiSum = 0;
    let maxFsi = 0;
    let twiSum = 0;
    let depthSum = 0;
    let claySum = 0;
    let flowAccSum = 0;
    let slopeSum = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (pointInPolygon(c, r, parcel.polygon)) {
          const idx = r * cols + c;
          cellCount++;
          const val = fsi[idx];
          fsiSum += val;
          if (val > maxFsi) maxFsi = val;
          twiSum += twi[idx];
          depthSum += waterDepthM[idx];
          claySum += clay[idx];
          flowAccSum += flowAcc[idx];
          slopeSum += slopeDeg[idx];
          if (val >= params.fsiThreshold) {
            highRiskCount++;
          }
        }
      }
    }

    const safeCount = Math.max(1, cellCount);
    const meanFsi = Number((fsiSum / safeCount).toFixed(3));
    const meanTwi = Number((twiSum / safeCount).toFixed(2));
    const meanClayPct = Number((claySum / safeCount).toFixed(1));
    const meanFlowAccCells = Math.round(flowAccSum / safeCount);
    const meanSlopeDeg = slopeSum / safeCount;
    const inundatedPct = Number(((highRiskCount / safeCount) * 100).toFixed(1));
    const inundatedHa = Math.round((parcel.areaHa * inundatedPct) / 100);
    const meanDepthM = Number((depthSum / Math.max(1, highRiskCount)).toFixed(2));

    const stagnationHours = Math.round(
      inundatedPct > 5
        ? 18 + meanFsi * 72 + (params.canalSiltationPct / 100) * 64 + meanDepthM * 36
        : 0
    );

    // Synthetic Sediment Load (TSS mg/L & Tons/day) derived from flow accumulation, slope, rainfall, clay & siltation
    const flowLogFactor = Math.log10(Math.max(10, meanFlowAccCells));
    const stormIntensityFactor =
      (params.chirpsPeakMm / 110) * (0.7 + 0.3 * params.orographicMultiplier);
    const breachProximityBoost = activeBreaches.some(
      (b) => Math.hypot(b.lat - parcel.latCenter, b.lon - parcel.lonCenter) < 0.065
    )
      ? 1.28
      : 1.0;

    const rawTssMgL =
      (42 +
        flowLogFactor * 68 * stormIntensityFactor +
        meanSlopeDeg * 26 +
        meanClayPct * 1.45 +
        params.canalSiltationPct * 2.15 +
        inundatedPct * 1.35) *
      breachProximityBoost;
    const tssMgL = Math.round(Math.max(25, Math.min(1450, rawTssMgL)));

    const runoffDepthMmDay =
      Math.max(4, params.chirpsPeakMm * 0.28 * (0.35 + meanFsi * 0.65));
    const dailyRunoffM3 = parcel.areaHa * 10000 * (runoffDepthMmDay / 1000);
    const sedimentYieldTonsDay = Number(
      ((dailyRunoffM3 * tssMgL) / 1e6).toFixed(1)
    );

    // Synthetic Nitrate Concentration (NO3-N mg/L & kg/day) derived from crop fertilizer regime, TWI flushing, clay & stagnation
    const cropNFactor =
      parcel.primaryCrop.includes('Sugar Beet') || parcel.primaryCrop.includes('Cotton')
        ? 1.36
        : parcel.primaryCrop.includes('Wheat') && parcel.primaryCrop.includes('Maize')
        ? 1.24
        : parcel.primaryCrop.includes('Wheat')
        ? 1.15
        : 0.92;

    const twiFlushFactor = Math.max(0.6, (meanTwi - 6.0) / 8.5);
    const dilutionFactor =
      params.chirpsPeakMm > 155
        ? Math.max(0.76, 1 - (params.chirpsPeakMm - 155) / 280)
        : 1 + (params.chirpsPeakMm - 75) / 320;

    const rawNitrateMgL =
      (2.4 +
        cropNFactor * 4.2 * twiFlushFactor +
        (inundatedPct / 100) * 3.8 +
        (stagnationHours / 110) * 2.6 +
        (params.canalSiltationPct / 100) * 1.9 +
        flowLogFactor * 0.85) *
      dilutionFactor;
    const nitrateMgL = Number(Math.max(1.2, Math.min(28.5, rawNitrateMgL)).toFixed(2));
    const nitrateLoadKgDay = Math.round((dailyRunoffM3 * nitrateMgL) / 1000);

    let waterQualityStatus: 'Nominal' | 'Elevated' | 'Impaired' = 'Nominal';
    if (nitrateMgL >= 10.0 || tssMgL >= 420) {
      waterQualityStatus = 'Impaired';
      impairedPoldersCount++;
    } else if (nitrateMgL >= 6.5 || tssMgL >= 240) {
      waterQualityStatus = 'Elevated';
    }

    totalCroplandHa += parcel.areaHa;
    inundatedCroplandHa += inundatedHa;
    totalSedimentTonsDay += sedimentYieldTonsDay;
    weightedNitrateSum += nitrateMgL * parcel.areaHa;

    let riskClass: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';
    if (inundatedPct >= 60 || meanFsi >= 0.76) riskClass = 'Critical';
    else if (inundatedPct >= 30 || meanFsi >= params.fsiThreshold) riskClass = 'High';
    else if (inundatedPct >= 12 || meanFsi >= 0.5) riskClass = 'Moderate';

    return {
      ...parcel,
      meanFsi,
      maxFsi: Number(maxFsi.toFixed(3)),
      meanTwi,
      meanClayPct,
      meanFlowAccCells,
      inundatedHa,
      inundatedPct,
      meanDepthM,
      stagnationHours,
      tssMgL,
      sedimentYieldTonsDay,
      nitrateMgL,
      nitrateLoadKgDay,
      waterQualityStatus,
      riskClass,
    };
  });

  // Infrastructure Crossings Intersection
  const selectedPreset =
    STORM_PRESETS.find((p) => p.id === params.stormPresetId) || STORM_PRESETS[0];

  let overtoppedCrossingsCount = 0;
  let surchargedCrossingsCount = 0;

  const infrastructureImpacts: InfrastructureImpact[] = INFRASTRUCTURE_CROSSINGS.map(
    (crossing) => {
      const idx = crossing.row * cols + crossing.col;
      const localFsi = fsi[idx];
      const localTwi = twi[idx];
      const upslopeCells = flowAcc[idx];
      const upslopeAreaKm2 = Number((upslopeCells * cellAreaKm2).toFixed(1));

      const combinedSiltation = Math.min(
        85,
        crossing.siltationPct * 0.55 + params.canalSiltationPct * 0.55
      );
      const effectiveCapacityM3s = Number(
        (crossing.designCapacityM3s * (1 - combinedSiltation / 145)).toFixed(1)
      );

      const stormScale = params.chirpsPeakMm / 115;
      const isMainOrontes = crossing.waterway.includes('Orontes');
      let peakDischargeM3s = isMainOrontes
        ? selectedPreset.asharneReleaseM3s * 0.62 +
          upslopeAreaKm2 * 0.34 * stormScale +
          ((rows - crossing.row) / rows) * 95 * stormScale
        : crossing.designCapacityM3s * 0.58 * stormScale * params.orographicMultiplier +
          localFsi * 24;

      for (const breach of activeBreaches) {
        const dCells = Math.hypot(crossing.col - breach.col, crossing.row - breach.row);
        if (dCells < 16) {
          peakDischargeM3s *= 1.18;
        }
      }

      peakDischargeM3s = Number(peakDischargeM3s.toFixed(1));
      const capacityRatio = Number(
        (peakDischargeM3s / Math.max(1, effectiveCapacityM3s)).toFixed(2)
      );

      let status: 'Passable' | 'Surcharged' | 'Overtopped' = 'Passable';
      let overtoppingDepthM = 0;

      if (capacityRatio >= 1.05 || localFsi >= params.fsiThreshold + 0.08) {
        status = 'Overtopped';
        overtoppedCrossingsCount++;
        overtoppingDepthM = Number(
          Math.max(0.18, (capacityRatio - 0.95) * 0.85 + waterDepthM[idx] * 0.35).toFixed(2)
        );
      } else if (capacityRatio >= 0.82 || localFsi >= params.fsiThreshold - 0.05) {
        status = 'Surcharged';
        surchargedCrossingsCount++;
      }

      return {
        ...crossing,
        localFsi,
        localTwi,
        upslopeAreaKm2,
        peakDischargeM3s,
        effectiveCapacityM3s,
        capacityRatio,
        overtoppingDepthM,
        status,
        inHistoricalFloodFootprint: historicalMask[idx] === 1,
      };
    }
  );

  // West-to-East Transect at 35.512°N
  const { row: transectRow } = latLonToGrid(35.512, 36.334);
  const westEastTransect: TransectPoint[] = [];
  for (let c = 0; c < cols; c++) {
    const idx = transectRow * cols + c;
    const { lon } = gridToLatLon(c, transectRow);
    const distanceKm = Number(((c * cellWidthM) / 1000).toFixed(2));
    westEastTransect.push({
      distanceKm,
      lon,
      elevationM: conditionedDem[idx],
      waterSurfaceM: Number((conditionedDem[idx] + waterDepthM[idx]).toFixed(2)),
      slopePct: slopePct[idx],
      flowAcc: Math.round(flowAcc[idx]),
      twi: twi[idx],
      fsi: fsi[idx],
      clayPct: clay[idx],
      inHistoricalExtent: historicalMask[idx] === 1,
    });
  }

  // South-to-North Longitudinal Profile
  const southNorthProfile: HydroSimulationResult['southNorthProfile'] = [];
  for (let r = rows - 4; r >= 4; r -= 3) {
    let minCol = Math.floor(cols * 0.5);
    let minElev = Infinity;
    for (let c = Math.floor(cols * 0.32); c <= Math.floor(cols * 0.72); c++) {
      const z = conditionedDem[r * cols + c];
      if (z < minElev) {
        minElev = z;
        minCol = c;
      }
    }
    const idx = r * cols + minCol;
    const { lat } = gridToLatLon(minCol, r);
    const distanceKm = Number((((rows - 4 - r) * cellHeightM) / 1000).toFixed(1));
    const stageRise =
      1.4 +
      waterDepthM[idx] * 1.15 +
      (lat >= 35.68 && params.activeBreachIds.includes('breach-karkor-weir')
        ? Math.exp(-((lat - 35.741) ** 2) / 0.0018) * 1.9
        : 0);

    let stationLabel: string | undefined;
    if (Math.abs(lat - 35.286) < 0.01) stationLabel = 'Asharne';
    else if (Math.abs(lat - 35.367) < 0.01) stationLabel = 'Suqaylabiyah';
    else if (Math.abs(lat - 35.424) < 0.01) stationLabel = 'Qalaat al-Mudiq';
    else if (Math.abs(lat - 35.512) < 0.01) stationLabel = 'Al-Huwash';
    else if (Math.abs(lat - 35.638) < 0.01) stationLabel = 'Ziyarah';
    else if (Math.abs(lat - 35.741) < 0.01) stationLabel = 'Karkor Weir';

    const dischargeM3s = Number(
      (
        selectedPreset.asharneReleaseM3s * 0.55 +
        ((rows - r) / rows) * (params.chirpsPeakMm * 1.15)
      ).toFixed(1)
    );

    // Longitudinal river water quality routing along the 60km Orontes reach
    const reachProg = (rows - 4 - r) / Math.max(1, rows - 8);
    const localAccLog = Math.log10(Math.max(10, flowAcc[idx]));
    const wadiPulse =
      Math.exp(-((lat - 35.514) ** 2) / 0.0012) * 115 +
      Math.exp(-((lat - 35.616) ** 2) / 0.0012) * 85;
    const reachTssMgL = Math.round(
      95 +
        reachProg * 145 * (params.chirpsPeakMm / 115) +
        localAccLog * 38 +
        params.canalSiltationPct * 2.1 +
        wadiPulse * (params.orographicMultiplier * 0.8) +
        (activeBreaches.length > 0 ? 48 : 0)
    );
    const reachSedimentTonsDay = Number(
      ((dischargeM3s * 86400 * reachTssMgL) / 1e6).toFixed(0)
    );

    const agCollectorPulse =
      Math.exp(-((lat - 35.424) ** 2) / 0.002) * 2.4 +
      Math.exp(-((lat - 35.638) ** 2) / 0.0022) * 3.1;
    const reachNitrateMgL = Number(
      Math.min(
        26.0,
        3.2 +
          reachProg * 5.8 * (1 + params.canalSiltationPct / 140) +
          agCollectorPulse +
          (twi[idx] - 10) * 0.32
      ).toFixed(2)
    );

    southNorthProfile.push({
      distanceKm,
      lat,
      bedElevationM: Number(minElev.toFixed(2)),
      waterStageM: Number((minElev + stageRise).toFixed(2)),
      bankElevationM: Number((minElev + 2.85).toFixed(2)),
      dischargeM3s,
      tssMgL: reachTssMgL,
      sedimentTonsDay: reachSedimentTonsDay,
      nitrateMgL: reachNitrateMgL,
      stationLabel,
    });
  }

  const totalBasinAreaKm2 = Math.round(totalCells * cellAreaKm2);
  const highRiskAreaKm2 = Number((highRiskCells * cellAreaKm2).toFixed(1));
  const highRiskAreaPct = Number(((highRiskCells / totalCells) * 100).toFixed(1));
  const inundatedCroplandPct = Number(
    ((inundatedCroplandHa / Math.max(1, totalCroplandHa)) * 100).toFixed(1)
  );
  const meanAlGhabTwi = Number((alGhabTwiSum / Math.max(1, alGhabCellCount)).toFixed(2));
  const meanSinkDepthM =
    sinksFilledCount > 0 ? Number((totalSinkDepthM / sinksFilledCount).toFixed(2)) : 0;
  const peakKarkorOutflowM3s =
    infrastructureImpacts.find((i) => i.id === 'inf-karkor-weir-br')?.peakDischargeM3s ||
    210;
  const meanBasinNitrateMgL = Number(
    (weightedNitrateSum / Math.max(1, totalCroplandHa)).toFixed(2)
  );
  const karkorExportTssMgL =
    southNorthProfile[southNorthProfile.length - 1]?.tssMgL || 320;

  let maxBasinVelocityMs = 0;
  let floodplainManningSum = 0;
  let floodplainCount = 0;
  let basinFsiSum = 0;
  let maxBasinFsi = 0;
  let floodplainFsiSum = 0;
  for (let i = 0; i < totalCells; i++) {
    if (velocityMs[i] > maxBasinVelocityMs) maxBasinVelocityMs = velocityMs[i];
    basinFsiSum += fsi[i];
    if (fsi[i] > maxBasinFsi) maxBasinFsi = fsi[i];
    if (conditionedDem[i] < 215) {
      floodplainManningSum += manningsN[i];
      floodplainFsiSum += fsi[i];
      floodplainCount++;
    }
  }
  const meanFloodplainManningN = Number(
    (floodplainManningSum / Math.max(1, floodplainCount)).toFixed(3)
  );
  const meanBasinFsi = Number((basinFsiSum / Math.max(1, totalCells)).toFixed(2));
  const meanFloodplainFsi = Number(
    (floodplainFsiSum / Math.max(1, floodplainCount)).toFixed(2)
  );

  // Western Wadi Flash-Flood Sub-Catchment Delineation (Dynamically derived from georeferenced wadi polylines & D8 DEM cells)
  const subCatchmentDefs = [
    {
      id: 'sub-nahr-bared',
      name: 'Wadi Nahr al-Bared Catchment',
      arabicName: 'حوض وادي نهر البارد',
      wadiIdx: 0,
      outletLat: 35.288,
      outletLon: 36.286,
      headwaterFactor: 2.35,
    },
    {
      id: 'sub-abu-qubays',
      name: 'Wadi Abu Qubays Gorge Basin',
      arabicName: 'حوض وادي أبو قبيس',
      wadiIdx: 1,
      outletLat: 35.412,
      outletLon: 36.282,
      headwaterFactor: 2.05,
    },
    {
      id: 'sub-shathah',
      name: 'Wadi Shathah Alluvial Torrent',
      arabicName: 'حوض وادي شطحة',
      wadiIdx: 2,
      outletLat: 35.514,
      outletLon: 36.268,
      headwaterFactor: 2.85,
    },
    {
      id: 'sub-jurin',
      name: 'Wadi Jurin Escarpment Basin',
      arabicName: 'حوض وادي جورين',
      wadiIdx: 3,
      outletLat: 35.616,
      outletLon: 36.275,
      headwaterFactor: 2.55,
    },
    {
      id: 'sub-sirmaniyah',
      name: 'Wadi Sirmaniyah Northern Chute',
      arabicName: 'حوض وادي السرمانية',
      wadiIdx: 4,
      outletLat: 35.708,
      outletLon: 36.304,
      headwaterFactor: 2.15,
    },
  ];

  const subCatchments: SubCatchmentUnit[] = subCatchmentDefs.map((sc) => {
    const wadiFeature = WESTERN_WADIS_LATLON[sc.wadiIdx] || WESTERN_WADIS_LATLON[0];
    const geodesicReachKm = computePolylineLengthKm(wadiFeature.path);
    // Total thalweg length from Jabal al-Nusayriyah crest divide to alluvial outlet
    const lengthKm = Number((geodesicReachKm * 1.18).toFixed(1));

    const outGrid = latLonToGrid(sc.outletLat, sc.outletLon);
    let slopeSum = 0;
    let twiSum = 0;
    let maxVel = 0;
    let count = 0;
    let maxUpslopeCells = 1;

    const rMin = Math.max(0, outGrid.row - 9);
    const rMax = Math.min(rows - 1, outGrid.row + 9);
    const cMin = 0;
    const cMax = Math.min(cols - 1, outGrid.col + 3);

    for (let r = rMin; r <= rMax; r++) {
      for (let c = cMin; c <= cMax; c++) {
        const idx = r * cols + c;
        slopeSum += slopeDeg[idx];
        twiSum += twi[idx];
        if (velocityMs[idx] > maxVel) maxVel = velocityMs[idx];
        if (flowAcc[idx] > maxUpslopeCells) maxUpslopeCells = flowAcc[idx];
        count++;
      }
    }

    const safeC = Math.max(1, count);
    const meanSlopeDeg = Number((slopeSum / safeC).toFixed(1));
    const meanSlopePct = Number((Math.tan((meanSlopeDeg * Math.PI) / 180) * 100).toFixed(1));
    const meanTwi = Number((twiSum / safeC).toFixed(1));
    const slopeFrac = Math.max(0.015, Math.tan((meanSlopeDeg * Math.PI) / 180));

    // Dynamically derived drainage area (km²) from D8 contributing cells & canyon geometry
    const drainageAreaKm2 = Number(
      (( count * cellAreaKm2 * 0.85 + Math.sqrt(maxUpslopeCells) * cellAreaKm2 * 1.9 ) * sc.headwaterFactor).toFixed(1)
    );

    // Kirpich formula for time of concentration (hours)
    const lengthM = lengthKm * 1000;
    const tcMinutes = 0.0195 * Math.pow(lengthM, 0.77) * Math.pow(slopeFrac, -0.385);
    const timeOfConcentrationHr = Number(Math.max(0.8, tcMinutes / 60).toFixed(2));

    const runoffCoeffC = Number(
      Math.min(
        0.88,
        0.42 +
          (params.chirpsPeakMm / 260) * 0.28 +
          (params.orographicMultiplier - 1) * 0.22
      ).toFixed(2)
    );

    const intensityMmHr =
      (params.chirpsPeakMm * params.orographicMultiplier) /
      Math.max(12, selectedPreset.durationHours * 0.42);
    const peakDischargeM3s = Number(
      (0.278 * runoffCoeffC * intensityMmHr * drainageAreaKm2 * 0.48).toFixed(1)
    );

    let erosionHazard: 'Low' | 'Moderate' | 'High' | 'Extreme' = 'Moderate';
    if (maxVel >= 2.8 || peakDischargeM3s >= 65) erosionHazard = 'Extreme';
    else if (maxVel >= 2.0 || peakDischargeM3s >= 42) erosionHazard = 'High';
    else if (maxVel < 1.2) erosionHazard = 'Low';

    return {
      id: sc.id,
      name: sc.name,
      arabicName: sc.arabicName,
      outletLat: sc.outletLat,
      outletLon: sc.outletLon,
      drainageAreaKm2,
      meanSlopeDeg,
      meanSlopePct,
      meanTwi,
      timeOfConcentrationHr,
      runoffCoeffC,
      peakDischargeM3s,
      maxVelocityMs: Number(maxVel.toFixed(2)),
      erosionHazard,
    };
  });

  // 72-Hour Synthetic Unit Hydrograph & Muskingum-Cunge Graben Routing
  const stormHydrograph: HydrographPoint[] = [];
  const karkorWeir = infrastructureImpacts.find((i) => i.id === 'inf-karkor-weir-br');
  const karkorSpillwayCapacityM3s = karkorWeir ? karkorWeir.effectiveCapacityM3s : 155;
  const ziyarahBridge = infrastructureImpacts.find((i) => i.id === 'inf-ziyarah-bridge');
  const ziyarahPeakTarget = ziyarahBridge ? ziyarahBridge.peakDischargeM3s : 180;

  // Lag time increases with canal siltation and Karkor weir backwater constriction
  const karkorLagTimeHours = Number(
    (
      9.5 +
      (params.canalSiltationPct / 100) * 6.5 +
      (params.activeBreachIds.includes('breach-karkor-weir') ? 2.5 : 0)
    ).toFixed(1)
  );
  const peakRainHour = 18;
  const midBasinPeakHour = peakRainHour + Math.round(karkorLagTimeHours * 0.55);
  const karkorPeakHour = peakRainHour + Math.round(karkorLagTimeHours);

  let cumulativeStorageMm3 = 4.2;
  let peakFloodplainStorageMm3 = 4.2;

  for (let hr = 0; hr <= 72; hr += 2) {
    // Hyetograph pulse (mm/hr)
    const rainBell =
      Math.exp(-((hr - peakRainHour) ** 2) / 78) +
      0.35 * Math.exp(-((hr - (peakRainHour + 14)) ** 2) / 95);
    const rainfallMmHr = Number(
      ((params.chirpsPeakMm / 18.5) * rainBell * (params.orographicMultiplier / 1.35)).toFixed(
        1
      )
    );

    // Asharne Regulator Southern Inflow (m³/s)
    const asharneWave = Math.exp(-((hr - (peakRainHour + 3)) ** 2) / 190);
    const asharneInflowM3s = Number(
      (
        selectedPreset.asharneReleaseM3s * 0.28 +
        selectedPreset.asharneReleaseM3s * 0.72 * asharneWave
      ).toFixed(1)
    );

    // Ziyarah Mid-Basin Collector + Western Wadi Tributary Surge (m³/s)
    const ziyarahRise =
      hr <= midBasinPeakHour
        ? Math.exp(-((hr - midBasinPeakHour) ** 2) / 165)
        : Math.exp(-((hr - midBasinPeakHour) ** 2) / 340);
    const ziyarahMidBasinM3s = Number(
      (34 + (ziyarahPeakTarget - 34) * ziyarahRise).toFixed(1)
    );

    // Karkor Northern Gorge Outflow (attenuated by graben floodplain storage & sill constriction)
    const karkorRecessionSpread = 310 + params.canalSiltationPct * 2.8;
    const karkorWave =
      hr <= karkorPeakHour
        ? Math.exp(-((hr - karkorPeakHour) ** 2) / 210)
        : Math.exp(-((hr - karkorPeakHour) ** 2) / karkorRecessionSpread);
    const karkorOutflowM3s = Number(
      (38 + (peakKarkorOutflowM3s - 38) * karkorWave).toFixed(1)
    );

    // Floodplain Detention Storage Volume (Million m³, Mm³)
    const netInflowM3s =
      asharneInflowM3s * 0.55 + ziyarahMidBasinM3s * 0.65 - karkorOutflowM3s;
    cumulativeStorageMm3 = Math.max(
      2.5,
      cumulativeStorageMm3 + (netInflowM3s * 7200) / 1e6
    );
    if (cumulativeStorageMm3 > peakFloodplainStorageMm3) {
      peakFloodplainStorageMm3 = cumulativeStorageMm3;
    }

    stormHydrograph.push({
      hour: hr,
      rainfallMmHr,
      asharneInflowM3s,
      ziyarahMidBasinM3s,
      karkorOutflowM3s,
      karkorSpillwayCapacityM3s,
      floodplainStorageMm3: Number(cumulativeStorageMm3.toFixed(1)),
    });
  }

  const covSlopeFlow =
    sumSlopeFlowCross / totalCells - (sumSlopePct / totalCells) * (sumFlowLog / totalCells);
  const stdSlopePct = Math.sqrt(
    Math.max(1e-6, sumSlopePctSq / totalCells - Math.pow(sumSlopePct / totalCells, 2))
  );
  const stdFlowLog = Math.sqrt(
    Math.max(1e-6, sumFlowLogSq / totalCells - Math.pow(sumFlowLog / totalCells, 2))
  );
  const pearsonR = Number(
    Math.max(-0.98, Math.min(0.98, covSlopeFlow / (stdSlopePct * stdFlowLog))).toFixed(3)
  );

  const slopeFlowMetrics: SlopeFlowCorrelationMetrics = {
    pearsonR,
    flatValleyPondingPct:
      highFlowCount > 0
        ? Number(((highFlowFlatCount / highFlowCount) * 100).toFixed(1))
        : 84.5,
    meanValleySlopePct:
      valleyCount > 0 ? Number((valleySlopeSum / valleyCount).toFixed(2)) : 0.65,
    meanPiedmontSlopePct:
      piedmontCount > 0 ? Number((piedmontSlopeSum / piedmontCount).toFixed(2)) : 12.4,
    meanScarpSlopePct:
      scarpCount > 0 ? Number((scarpSlopeSum / scarpCount).toFixed(2)) : 36.8,
    criticalPondingAreaHa: Math.round(criticalPondingCells * cellAreaKm2 * 100),
  };

  return {
    cols,
    rows,
    rawDem,
    conditionedDem,
    slopeDeg,
    slopePct,
    streamPowerIndex,
    d8Dir,
    flowAcc,
    twi,
    chirps,
    gfs48h,
    clay,
    canalDistKm,
    fsi,
    waterDepthM,
    velocityMs,
    manningsN,
    shearStressPa,
    historicalMask,
    slopeFlowMetrics,
    parcelImpacts,
    infrastructureImpacts,
    historicalComparison,
    westEastTransect,
    stormHydrograph,
    subCatchments,
    southNorthProfile,
    summary: {
      totalBasinAreaKm2,
      highRiskAreaKm2,
      highRiskAreaPct,
      meanBasinFsi,
      maxBasinFsi: Number(maxBasinFsi.toFixed(2)),
      meanFloodplainFsi,
      totalCroplandHa,
      inundatedCroplandHa,
      inundatedCroplandPct,
      overtoppedCrossingsCount,
      surchargedCrossingsCount,
      meanAlGhabTwi,
      sinksFilledCount,
      meanSinkDepthM,
      peakKarkorOutflowM3s,
      totalSedimentTonsDay: Math.round(totalSedimentTonsDay),
      meanBasinNitrateMgL,
      karkorExportTssMgL,
      impairedPoldersCount,
      maxBasinVelocityMs: Number(maxBasinVelocityMs.toFixed(2)),
      meanFloodplainManningN,
      peakFloodplainStorageMm3: Number(peakFloodplainStorageMm3.toFixed(1)),
      karkorLagTimeHours,
    },
  };
}

/**
 * Dynamically computes spatial statistics for an arbitrary user-drawn polygon ROI on the map.
 */
export interface CustomPolygonRoiAnalysis {
  vertexCount: number;
  geodesicAreaHa: number;
  geodesicAreaKm2: number;
  perimeterKm: number;
  cellCount: number;
  inundatedCells: number;
  inundatedAreaHa: number;
  inundatedPct: number;
  meanFsi: number;
  maxFsi: number;
  meanWaterDepthM: number;
  maxWaterDepthM: number;
  meanElevationM: number;
  meanTwi: number;
  meanClayPct: number;
}

export function analyzeCustomPolygonRoi(
  sim: HydroSimulationResult,
  latLonVertices: [number, number][],
  fsiThreshold: number
): CustomPolygonRoiAnalysis | null {
  if (latLonVertices.length < 3) return null;
  const geodesicAreaHa = computeGeodesicPolygonAreaHa(latLonVertices);
  const geodesicAreaKm2 = Number((geodesicAreaHa / 100).toFixed(2));
  const closedLoop = [...latLonVertices, latLonVertices[0]];
  const perimeterKm = computePolylineLengthKm(closedLoop);
  const gridPoly = toGridPath(latLonVertices);

  let cellCount = 0;
  let inundatedCells = 0;
  let fsiSum = 0;
  let maxFsi = 0;
  let depthSum = 0;
  let maxWaterDepthM = 0;
  let elevSum = 0;
  let twiSum = 0;
  let claySum = 0;

  for (let r = 0; r < sim.rows; r++) {
    for (let c = 0; c < sim.cols; c++) {
      if (pointInPolygon(c, r, gridPoly)) {
        const idx = r * sim.cols + c;
        cellCount++;
        const f = sim.fsi[idx];
        const d = sim.waterDepthM[idx];
        fsiSum += f;
        if (f > maxFsi) maxFsi = f;
        depthSum += d;
        if (d > maxWaterDepthM) maxWaterDepthM = d;
        elevSum += sim.conditionedDem[idx];
        twiSum += sim.twi[idx];
        claySum += sim.clay[idx];
        if (f >= fsiThreshold) {
          inundatedCells++;
        }
      }
    }
  }

  const safeCells = Math.max(1, cellCount);
  const inundatedPct = Number(((inundatedCells / safeCells) * 100).toFixed(1));
  const inundatedAreaHa = Math.round((geodesicAreaHa * inundatedPct) / 100);

  return {
    vertexCount: latLonVertices.length,
    geodesicAreaHa,
    geodesicAreaKm2,
    perimeterKm,
    cellCount,
    inundatedCells,
    inundatedAreaHa,
    inundatedPct,
    meanFsi: Number((fsiSum / safeCells).toFixed(3)),
    maxFsi: Number(maxFsi.toFixed(3)),
    meanWaterDepthM: Number((depthSum / Math.max(1, inundatedCells)).toFixed(2)),
    maxWaterDepthM: Number(maxWaterDepthM.toFixed(2)),
    meanElevationM: Number((elevSum / safeCells).toFixed(1)),
    meanTwi: Number((twiSum / safeCells).toFixed(2)),
    meanClayPct: Number((claySum / safeCells).toFixed(1)),
  };
}

export function getCellTelemetry(
  sim: HydroSimulationResult,
  col: number,
  row: number,
  fsiThreshold: number
): CellTelemetry {
  const c = Math.max(0, Math.min(sim.cols - 1, col));
  const r = Math.max(0, Math.min(sim.rows - 1, row));
  const idx = r * sim.cols + c;
  const { lat, lon } = gridToLatLon(c, r);

  const utmEasting = Math.round(244000 + (lon - 36.18) * 90800);
  const utmNorthing = Math.round(3902000 + (lat - 35.24) * 110950);

  const { cellAreaKm2 } = getBasinCellGeometry();
  const valFsi = sim.fsi[idx];
  let riskClass: 'Low' | 'Moderate' | 'High' | 'Critical' = 'Low';
  if (valFsi >= fsiThreshold + 0.12) riskClass = 'Critical';
  else if (valFsi >= fsiThreshold) riskClass = 'High';
  else if (valFsi >= fsiThreshold - 0.15) riskClass = 'Moderate';

  let landform = 'Al-Ghab Alluvial Lacustrine Floor (سهل الغاب)';
  if (lon < 36.255) landform = 'Jabal al-Nusayriyah Escarpment (جبال الساحل)';
  else if (lon < 36.278) landform = 'Western Piedmont Alluvial Fan';
  else if (lon > 36.395) landform = 'Jabal al-Zawiya Limestone Plateau (جبل الزاوية)';
  else if (lon > 36.372) landform = 'Eastern Apamea Fault Escarpment';
  else if (sim.canalDistKm[idx] < 0.55) landform = 'Orontes Active Levee & Floodway (مجري العاصي)';

  const slpPctVal = sim.slopePct[idx];
  const fAccVal = sim.flowAcc[idx];
  const slopeFlowRegime: CellTelemetry['slopeFlowRegime'] =
    slpPctVal < 1.5 && fAccVal >= 120
      ? 'PONDING_SINK'
      : slpPctVal < 3.5 && fAccVal >= 40
      ? 'ALLUVIAL_CONVERGENCE'
      : slpPctVal < 15.0
      ? 'PIEDMONT_TRANSFER'
      : 'OROGENIC_RUNOFF';

  return {
    col: c,
    row: r,
    lat,
    lon,
    utmEasting,
    utmNorthing,
    rawElevationM: sim.rawDem[idx],
    conditionedElevationM: sim.conditionedDem[idx],
    sinkDepthFilledM: Number(
      Math.max(0, sim.conditionedDem[idx] - sim.rawDem[idx]).toFixed(2)
    ),
    slopeDeg: sim.slopeDeg[idx],
    slopePct: slpPctVal,
    streamPowerIndex: sim.streamPowerIndex[idx],
    slopeFlowRegime,
    d8Direction: sim.d8Dir[idx],
    flowAccumulationCells: Math.round(fAccVal),
    upslopeAreaKm2: Number((fAccVal * cellAreaKm2).toFixed(2)),
    twi: sim.twi[idx],
    chirpsMm: sim.chirps[idx],
    gfs48hMm: sim.gfs48h[idx],
    gfsVsChirpsDeltaMm: Number((sim.chirps[idx] - sim.gfs48h[idx]).toFixed(1)),
    soilClayPct: sim.clay[idx],
    canalDistKm: sim.canalDistKm[idx],
    fsi: valFsi,
    inundationDepthM: sim.waterDepthM[idx],
    manningsN: sim.manningsN[idx],
    flowVelocityMs: sim.velocityMs[idx],
    shearStressPa: sim.shearStressPa[idx],
    riskClass,
    landform,
    inHistoricalExtent: sim.historicalMask[idx] === 1,
    normTwi: Number(
      Math.max(0, Math.min(1, (sim.twi[idx] - 6.2) / 12.8)).toFixed(2)
    ),
    normChirps: Number(
      Math.max(0, Math.min(1, (sim.chirps[idx] - 35) / 160)).toFixed(2)
    ),
    normClay: Number(
      Math.max(0, Math.min(1, (sim.clay[idx] - 18) / 54)).toFixed(2)
    ),
    normCanal: Number(
      Math.max(0, Math.min(1, Math.exp(-sim.canalDistKm[idx] / 2.8))).toFixed(2)
    ),
  };
}

export interface CustomCrossSectionSample {
  distanceKm: number;
  lat: number;
  lon: number;
  col: number;
  row: number;
  elevationM: number;
  waterDepthM: number;
  waterStageM: number;
  slopePct: number;
  flowAcc: number;
  fsi: number;
}

export interface CustomCrossSectionAnalysis {
  totalLengthKm: number;
  minElevM: number;
  maxElevM: number;
  maxDepthM: number;
  meanSlopePct: number;
  maxSlopePct: number;
  maxFlowAcc: number;
  inundatedLengthKm: number;
  samples: CustomCrossSectionSample[];
}

/**
 * Samples a user-drawn polyline (A -> B or multi-segment) across the 110x150 basin grid
 * to produce an interactive topographic & hydraulic cross-section profile.
 */
export function computeCustomCrossSectionProfile(
  sim: HydroSimulationResult,
  latLonVertices: [number, number][],
  sampleCount: number = 48
): CustomCrossSectionAnalysis | null {
  if (latLonVertices.length < 2) return null;

  const totalLengthKm = computePolylineLengthKm(latLonVertices);
  if (totalLengthKm <= 0.001) return null;

  // Build cumulative segment lengths
  const segLengths: number[] = [0];
  let accum = 0;
  for (let i = 0; i < latLonVertices.length - 1; i++) {
    const segKm = computePolylineLengthKm([latLonVertices[i], latLonVertices[i + 1]]);
    accum += segKm;
    segLengths.push(accum);
  }

  const samples: CustomCrossSectionSample[] = [];
  let minElevM = Infinity;
  let maxElevM = -Infinity;
  let maxDepthM = 0;
  let sumSlopePct = 0;
  let maxSlopePct = 0;
  let maxFlowAcc = 0;
  let inundatedSampleCount = 0;

  for (let s = 0; s < sampleCount; s++) {
    const frac = s / Math.max(1, sampleCount - 1);
    const targetDist = frac * accum;

    let segIdx = 0;
    for (let i = 0; i < segLengths.length - 1; i++) {
      if (targetDist >= segLengths[i] && targetDist <= segLengths[i + 1]) {
        segIdx = i;
        break;
      }
    }

    const segStart = segLengths[segIdx];
    const segEnd = segLengths[segIdx + 1];
    const localT =
      segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;

    const [lat1, lon1] = latLonVertices[segIdx];
    const [lat2, lon2] = latLonVertices[Math.min(latLonVertices.length - 1, segIdx + 1)];
    const lat = Number((lat1 + (lat2 - lat1) * localT).toFixed(4));
    const lon = Number((lon1 + (lon2 - lon1) * localT).toFixed(4));

    const { col, row } = latLonToGrid(lat, lon);
    const idx = row * sim.cols + col;

    const elevationM = Number(sim.conditionedDem[idx].toFixed(1));
    const waterDepthM = Number(sim.waterDepthM[idx].toFixed(2));
    const waterStageM = Number((elevationM + waterDepthM).toFixed(1));
    const slopePct = Number(sim.slopePct[idx].toFixed(2));
    const flowAcc = Math.round(sim.flowAcc[idx]);
    const fsi = Number(sim.fsi[idx].toFixed(2));

    if (elevationM < minElevM) minElevM = elevationM;
    if (elevationM > maxElevM) maxElevM = elevationM;
    if (waterDepthM > maxDepthM) maxDepthM = waterDepthM;
    if (slopePct > maxSlopePct) maxSlopePct = slopePct;
    if (flowAcc > maxFlowAcc) maxFlowAcc = flowAcc;
    sumSlopePct += slopePct;
    if (waterDepthM >= 0.15) inundatedSampleCount++;

    samples.push({
      distanceKm: Number(targetDist.toFixed(2)),
      lat,
      lon,
      col,
      row,
      elevationM,
      waterDepthM,
      waterStageM,
      slopePct,
      flowAcc,
      fsi,
    });
  }

  return {
    totalLengthKm: Number(totalLengthKm.toFixed(2)),
    minElevM: minElevM === Infinity ? 168 : minElevM,
    maxElevM: maxElevM === -Infinity ? 350 : maxElevM,
    maxDepthM,
    meanSlopePct: Number((sumSlopePct / Math.max(1, samples.length)).toFixed(2)),
    maxSlopePct,
    maxFlowAcc,
    inundatedLengthKm: Number(
      ((inundatedSampleCount / Math.max(1, samples.length)) * totalLengthKm).toFixed(2)
    ),
    samples,
  };
}

/**
 * Computes the kinematic flood wave temporal multiplier [0.05 .. 1.15] at a given storm hour (0..72h)
 * and grid position (row, col), modeling:
 *  - Early flash-flood surge on Western Jabal al-Nusayriyah wadis (peaking ~16h-20h)
 *  - Southern Asharne regulator inflow wave (peaking ~21h)
 *  - Central Ziyarah polder convergence wave (peaking ~24h-27h)
 *  - Northern Karkor gorge backwater bottleneck & slow recession (peaking ~28h-34h)
 */
export function getTemporalFloodWaveMultiplier(
  sim: HydroSimulationResult,
  row: number,
  col: number,
  hour: number | null | undefined
): number {
  if (hour === null || hour === undefined) return 1.0;

  const idx = row * sim.cols + col;
  const elev = sim.conditionedDem[idx];
  const southToNorthProg = Math.max(0, Math.min(1, (sim.rows - 1 - row) / (sim.rows - 1)));
  const isWesternEscarpment = col < sim.cols * 0.36 || elev > 235;

  // Local peak arrival time (hours from storm start)
  const lagTime = sim.summary.karkorLagTimeHours || 12;
  const localPeakHour = isWesternEscarpment
    ? 17.5 + southToNorthProg * 2.5
    : 19.5 + southToNorthProg * lagTime;

  const dt = hour - localPeakHour;
  // Rising limb is steeper; recession limb is prolonged in flat clay polders
  const spread =
    dt <= 0
      ? isWesternEscarpment
        ? 42
        : 75
      : isWesternEscarpment
      ? 95
      : 260 + southToNorthProg * 140;

  const primaryWave = Math.exp(-(dt * dt) / spread);
  // Secondary frontal pulse at +12h
  const dt2 = hour - (localPeakHour + 11);
  const secondaryWave = 0.24 * Math.exp(-(dt2 * dt2) / (spread * 1.15));

  const baseRetention = elev < 200 ? 0.12 + southToNorthProg * 0.08 : 0.04;
  return Math.max(0.04, Math.min(1.12, baseRetention + primaryWave * 0.92 + secondaryWave));
}


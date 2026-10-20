'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  HydroSimulationResult,
  ORONTES_MAIN_CHANNEL_PATH,
  EAST_IRRIGATION_CANAL_PATH,
  WEST_INTERCEPTOR_CANAL_PATH,
  CANAL_BREACH_HOTSPOTS,
  gridToLatLon,
  RasterLayerType,
} from '@/lib/orontes-hydro-engine';

interface FlowAccumulationHeatmapProps {
  sim: HydroSimulationResult;
  selectedCell: { col: number; row: number };
  onSelectCell: (col: number, row: number) => void;
  onSelectLayer?: (layer: RasterLayerType) => void;
  simplifiedMode?: boolean;
}

interface HeatmapBin {
  binCol: number;
  binRow: number;
  gridCol: number;
  gridRow: number;
  reachKm: number; // 0 km (Asharne South) to 62 km (Karkor North)
  crossKm: number; // 0 km (West) to 27.3 km (East)
  cumulativeFlowCells: number;
  upslopeAreaKm2: number;
  meanSlopePct: number;
  meanSpi: number;
  meanTwi: number;
  bottleneckScore: number;
  isBottleneck: boolean;
}

export default function FlowAccumulationHeatmap({
  sim,
  selectedCell,
  onSelectCell,
  onSelectLayer,
  simplifiedMode = false,
}: FlowAccumulationHeatmapProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredBin, setHoveredBin] = useState<HeatmapBin | null>(null);
  const [metricMode, setMetricMode] = useState<'flowAcc' | 'slopePct' | 'bottleneck'>('slopePct');

  // Reduce SVG DOM node count by 75% in simplified mobile/low-power mode (11x15 vs 22x30)
  const binCols = simplifiedMode ? 11 : 22;
  const binRows = simplifiedMode ? 15 : 30;

  // Keep stable refs for callbacks so D3 doesn't rebuild SVG on parent re-renders
  const onSelectCellRef = useRef(onSelectCell);
  const onSelectLayerRef = useRef(onSelectLayer);
  useEffect(() => {
    onSelectCellRef.current = onSelectCell;
    onSelectLayerRef.current = onSelectLayer;
  }, [onSelectCell, onSelectLayer]);

  // Downsample the 110x150 grid into the D3 matrix across the 60km basin
  const { bins, reachTotals, topBottlenecks } = useMemo(() => {
    const cellAreaKm2 = (248 * 415) / 1e6;
    const colStep = sim.cols / binCols;
    const rowStep = sim.rows / binRows;
    const sampleStride = simplifiedMode ? 2 : 1;

    const computedBins: HeatmapBin[] = [];
    const longitudinalTotals: {
      binRow: number;
      reachKm: number;
      lat: number;
      cumulativeAreaKm2: number;
      maxBottleneck: number;
    }[] = [];

    for (let br = 0; br < binRows; br++) {
      const rStart = Math.floor(br * rowStep);
      const rEnd = Math.min(sim.rows - 1, Math.floor((br + 1) * rowStep));
      const centerGridRow = Math.round((rStart + rEnd) * 0.5);
      const reachKm = Number(
        (((sim.rows - 1 - centerGridRow) * 415) / 1000).toFixed(1)
      );

      let rowMaxFlow = 0;
      let rowMaxBottleneck = 0;

      for (let bc = 0; bc < binCols; bc++) {
        const cStart = Math.floor(bc * colStep);
        const cEnd = Math.min(sim.cols - 1, Math.floor((bc + 1) * colStep));
        const centerGridCol = Math.round((cStart + cEnd) * 0.5);
        const crossKm = Number(((centerGridCol * 248) / 1000).toFixed(1));

        let maxAcc = 0;
        let sumAcc = 0;
        let sumTwi = 0;
        let sumSlopePct = 0;
        let sumSpi = 0;
        let minSlope = 90;
        let count = 0;

        for (let r = rStart; r <= rEnd; r += sampleStride) {
          for (let c = cStart; c <= cEnd; c += sampleStride) {
            const idx = r * sim.cols + c;
            const acc = sim.flowAcc[idx];
            if (acc > maxAcc) maxAcc = acc;
            sumAcc += acc;
            sumTwi += sim.twi[idx];
            sumSlopePct += sim.slopePct[idx];
            sumSpi += sim.streamPowerIndex[idx];
            if (sim.slopeDeg[idx] < minSlope) minSlope = sim.slopeDeg[idx];
            count++;
          }
        }

        const centerIdx = centerGridRow * sim.cols + centerGridCol;
        if (sim.flowAcc[centerIdx] > maxAcc) {
          maxAcc = sim.flowAcc[centerIdx];
        }

        const safeCount = Math.max(1, count);
        const meanTwi = sumTwi / safeCount;
        const meanSlopePct = Number((sumSlopePct / safeCount).toFixed(2));
        const meanSpi = Number((sumSpi / safeCount).toFixed(2));
        const effectiveCells = maxAcc * 0.78 + (sumAcc / safeCount) * 0.22;
        const upslopeAreaKm2 = Number((effectiveCells * cellAreaKm2).toFixed(1));

        const logAccNorm = Math.min(1, Math.log10(Math.max(1, effectiveCells)) / 3.6);
        const flatFactor = Math.max(0, 1 - minSlope / 4.5);
        const twiNorm = Math.max(0, Math.min(1, (meanTwi - 8) / 11));
        const bottleneckScore = Number(
          (logAccNorm * 0.55 + flatFactor * 0.25 + twiNorm * 0.2).toFixed(3)
        );

        if (upslopeAreaKm2 > rowMaxFlow) rowMaxFlow = upslopeAreaKm2;
        if (bottleneckScore > rowMaxBottleneck) rowMaxBottleneck = bottleneckScore;

        computedBins.push({
          binCol: bc,
          binRow: br,
          gridCol: centerGridCol,
          gridRow: centerGridRow,
          reachKm,
          crossKm,
          cumulativeFlowCells: Math.round(effectiveCells),
          upslopeAreaKm2,
          meanSlopePct,
          meanSpi,
          meanTwi: Number(meanTwi.toFixed(1)),
          bottleneckScore,
          isBottleneck: bottleneckScore >= 0.72 && upslopeAreaKm2 >= 28,
        });
      }

      const { lat } = gridToLatLon(55, centerGridRow);
      longitudinalTotals.push({
        binRow: br,
        reachKm,
        lat,
        cumulativeAreaKm2: Number(rowMaxFlow.toFixed(1)),
        maxBottleneck: rowMaxBottleneck,
      });
    }

    const sortedBottlenecks = [...computedBins]
      .filter((b) => b.gridCol >= 32 && b.gridCol <= 78)
      .sort((a, b) => b.bottleneckScore - a.bottleneckScore);

    const minSpacing = simplifiedMode ? 2 : 4;
    const picked: HeatmapBin[] = [];
    for (const candidate of sortedBottlenecks) {
      if (
        picked.every(
          (p) =>
            Math.hypot(p.binCol - candidate.binCol, p.binRow - candidate.binRow) >=
            minSpacing
        )
      ) {
        picked.push(candidate);
        if (picked.length === 4) break;
      }
    }

    return {
      bins: computedBins,
      reachTotals: longitudinalTotals,
      topBottlenecks: picked,
    };
  }, [sim, binCols, binRows, simplifiedMode]);

  // Render D3 Heatmap + River Network Overlay + 60km Cumulative Curve
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 322;
    const height = 224;
    const margin = { top: 18, right: 64, bottom: 22, left: 34 };
    const mapWidth = width - margin.left - margin.right;
    const mapHeight = height - margin.top - margin.bottom;
    const profileWidth = 46;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scaleBand<number>()
      .domain(d3.range(binCols))
      .range([0, mapWidth])
      .paddingInner(simplifiedMode ? 0.02 : 0.05);

    const yScale = d3
      .scaleBand<number>()
      .domain(d3.range(binRows))
      .range([0, mapHeight])
      .paddingInner(simplifiedMode ? 0.02 : 0.05);

    const gridXScale = d3.scaleLinear().domain([0, sim.cols - 1]).range([0, mapWidth]);
    const gridYScale = d3.scaleLinear().domain([0, sim.rows - 1]).range([0, mapHeight]);

    const maxFlowCells = d3.max(bins, (d) => d.cumulativeFlowCells) || 2500;
    const flowColorScale = d3
      .scaleSequentialLog<string>()
      .domain([1.5, maxFlowCells])
      .interpolator(
        d3.interpolateRgbBasis([
          '#090d16',
          '#172554',
          '#0284c7',
          '#22d3ee',
          '#facc15',
          '#f43f5e',
        ])
      );

    const bottleneckColorScale = d3
      .scaleSequential<string>()
      .domain([0.15, 0.92])
      .interpolator(
        d3.interpolateRgbBasis([
          '#090d16',
          '#1e293b',
          '#0f766e',
          '#eab308',
          '#f97316',
          '#e11d48',
        ])
      );

    const slopePctColorScale = d3
      .scaleSequential<string>()
      .domain([0, 1])
      .interpolator(
        d3.interpolateRgbBasis([
          '#064e3b',
          '#0d9488',
          '#10b981',
          '#eab308',
          '#ea580c',
          '#f8fafc',
        ])
      );

    // 1. Render 2D Heatmap Matrix Cells
    const cellSelection = g
      .selectAll('rect.hm-cell')
      .data(bins)
      .join('rect')
      .attr('class', 'hm-cell cursor-pointer')
      .attr('x', (d) => xScale(d.binCol) ?? 0)
      .attr('y', (d) => yScale(d.binRow) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => {
        if (metricMode === 'slopePct') {
          if (d.meanSlopePct < 1.5 && d.cumulativeFlowCells >= 120) {
            return '#0284c7'; // Flat valley ponding sink (Slope < 1.5% + High FlowAcc)
          }
          const normSlope = Math.min(1, Math.pow(d.meanSlopePct / 45.0, 0.65));
          return slopePctColorScale(normSlope);
        }
        return metricMode === 'flowAcc'
          ? flowColorScale(Math.max(1.5, d.cumulativeFlowCells))
          : bottleneckColorScale(d.bottleneckScore);
      })
      .attr('stroke', (d) =>
        metricMode === 'slopePct' && d.meanSlopePct < 1.5 && d.cumulativeFlowCells >= 120
          ? 'rgba(56, 189, 248, 0.8)'
          : d.isBottleneck && metricMode === 'bottleneck'
          ? 'rgba(251, 113, 133, 0.65)'
          : 'none'
      )
      .attr('stroke-width', 0.6)
      .on('click', (_event, d) => {
        setHoveredBin(d);
        onSelectCellRef.current(d.gridCol, d.gridRow);
        if (onSelectLayerRef.current) {
          onSelectLayerRef.current(metricMode === 'slopePct' ? 'slope' : 'flowAcc');
        }
      });

    if (!simplifiedMode) {
      cellSelection.on('mouseenter', (_event, d) => {
        setHoveredBin(d);
      });
    }

    // 2. Overlay River Network & Irrigation Canals
    const lineGen = d3
      .line<[number, number]>()
      .x((d) => gridXScale(d[0]))
      .y((d) => gridYScale(d[1]))
      .curve(simplifiedMode ? d3.curveLinear : d3.curveCatmullRom.alpha(0.5));

    [EAST_IRRIGATION_CANAL_PATH, WEST_INTERCEPTOR_CANAL_PATH].forEach((canalPath) => {
      g.append('path')
        .datum(canalPath)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(186, 230, 253, 0.65)')
        .attr('stroke-width', 1.1)
        .attr('stroke-dasharray', '2,2')
        .attr('pointer-events', 'none')
        .attr('d', lineGen);
    });

    if (!simplifiedMode) {
      g.append('path')
        .datum(ORONTES_MAIN_CHANNEL_PATH)
        .attr('fill', 'none')
        .attr('stroke', '#090d16')
        .attr('stroke-width', 2.8)
        .attr('pointer-events', 'none')
        .attr('d', lineGen);
    }

    g.append('path')
      .datum(ORONTES_MAIN_CHANNEL_PATH)
      .attr('fill', 'none')
      .attr('stroke', '#e0f2fe')
      .attr('stroke-width', 1.5)
      .attr('pointer-events', 'none')
      .attr('d', lineGen);

    // 3. Highlight Primary Drainage Bottleneck Hotspots along the River Network
    const bottleneckGroup = g
      .selectAll('g.bn-node')
      .data(topBottlenecks)
      .join('g')
      .attr('class', 'bn-node cursor-pointer')
      .attr(
        'transform',
        (d) =>
          `translate(${(xScale(d.binCol) ?? 0) + xScale.bandwidth() / 2},${
            (yScale(d.binRow) ?? 0) + yScale.bandwidth() / 2
          })`
      )
      .on('click', (_e, d) => {
        setHoveredBin(d);
        onSelectCellRef.current(d.gridCol, d.gridRow);
        if (onSelectLayerRef.current) onSelectLayerRef.current('flowAcc');
      });

    if (!simplifiedMode) {
      bottleneckGroup.on('mouseenter', (_e, d) => setHoveredBin(d));
      bottleneckGroup
        .append('circle')
        .attr('r', 4.5)
        .attr('fill', 'rgba(244, 63, 94, 0.3)')
        .attr('stroke', '#fb7185')
        .attr('stroke-width', 1.2);
    }

    bottleneckGroup
      .append('circle')
      .attr('r', simplifiedMode ? 3.2 : 1.7)
      .attr('fill', simplifiedMode ? '#fb7185' : '#ffffff')
      .attr('stroke', simplifiedMode ? '#ffffff' : 'none')
      .attr('stroke-width', simplifiedMode ? 1 : 0);

    // Canal Breach diamond markers
    g.selectAll('path.breach-pt')
      .data(CANAL_BREACH_HOTSPOTS)
      .join('path')
      .attr('d', d3.symbol().type(d3.symbolDiamond).size(18))
      .attr(
        'transform',
        (d) => `translate(${gridXScale(d.col)},${gridYScale(d.row)})`
      )
      .attr('fill', '#f59e0b')
      .attr('stroke', '#090d16')
      .attr('stroke-width', 0.8)
      .attr('pointer-events', 'none');

    // 4. Selected Cell Reticle on Heatmap
    const selX = gridXScale(selectedCell.col);
    const selY = gridYScale(selectedCell.row);
    g.append('circle')
      .attr('cx', selX)
      .attr('cy', selY)
      .attr('r', 4.8)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.6)
      .attr('pointer-events', 'none');

    // 5. Left Axis (0 km Asharne South -> 60 km Karkor North)
    const yAxisScale = d3.scaleLinear().domain([62, 0]).range([0, mapHeight]);
    const yAxis = d3
      .axisLeft(yAxisScale)
      .tickValues([0, 15, 30, 45, 60])
      .tickFormat((d) => `${d}كم`)
      .tickSize(3);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').attr('stroke', '#334155');
    yAxisG.selectAll('line').attr('stroke', '#334155');
    yAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', '8.5px');

    // Bottom X Axis (0 km West -> 27 km East)
    const xAxisScale = d3.scaleLinear().domain([0, 27]).range([0, mapWidth]);
    const xAxis = d3
      .axisBottom(xAxisScale)
      .tickValues([0, 9, 14, 20, 27])
      .tickFormat((d) => `${d}كم`)
      .tickSize(3);

    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${mapHeight})`)
      .call(xAxis);
    xAxisG.select('.domain').attr('stroke', '#334155');
    xAxisG.selectAll('line').attr('stroke', '#334155');
    xAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'IBM Plex Mono, monospace')
      .attr('font-size', '8.5px');

    g.append('text')
      .attr('x', 2)
      .attr('y', -5)
      .attr('fill', '#94a3b8')
      .attr('font-family', 'IBM Plex Sans Arabic, sans-serif')
      .attr('font-size', '8.5px')
      .text('الغرب (النصيرية)');

    g.append('text')
      .attr('x', gridXScale(55))
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#38bdf8')
      .attr('font-family', 'IBM Plex Sans Arabic, sans-serif')
      .attr('font-size', '8.5px')
      .attr('font-weight', '600')
      .text('مخرج قرقور شمالاً (60 كم)');

    g.append('text')
      .attr('x', mapWidth)
      .attr('y', -5)
      .attr('text-anchor', 'end')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'IBM Plex Sans Arabic, sans-serif')
      .attr('font-size', '8.5px')
      .text('الشرق (الزاوية)');

    // 6. Right-Side 60km Longitudinal Cumulative Flow Accumulation Curve
    const profG = g
      .append('g')
      .attr('transform', `translate(${mapWidth + 8}, 0)`);

    profG
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', profileWidth)
      .attr('height', mapHeight)
      .attr('fill', '#090d14')
      .attr('stroke', '#1e2633');

    const maxCumArea = d3.max(reachTotals, (d) => d.cumulativeAreaKm2) || 300;
    const profX = d3
      .scaleLinear()
      .domain([0, maxCumArea])
      .range([2, profileWidth - 3]);
    const profY = d3
      .scaleLinear()
      .domain([0, binRows - 1])
      .range([0, mapHeight]);

    const curveType = simplifiedMode ? d3.curveLinear : d3.curveMonotoneY;

    const areaGen = d3
      .area<(typeof reachTotals)[0]>()
      .x0(0)
      .x1((d) => profX(d.cumulativeAreaKm2))
      .y((d) => profY(d.binRow))
      .curve(curveType);

    const profLineGen = d3
      .line<(typeof reachTotals)[0]>()
      .x((d) => profX(d.cumulativeAreaKm2))
      .y((d) => profY(d.binRow))
      .curve(curveType);

    profG
      .append('path')
      .datum(reachTotals)
      .attr('fill', 'rgba(56, 189, 248, 0.22)')
      .attr('d', areaGen);

    profG
      .append('path')
      .datum(reachTotals)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.4)
      .attr('d', profLineGen);

    profG
      .append('text')
      .attr('x', profileWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#cbd5e1')
      .attr('font-family', 'IBM Plex Sans Arabic, sans-serif')
      .attr('font-size', '8px')
      .text('الحوض كم²');

    const karkorReach = reachTotals[Math.min(reachTotals.length - 1, simplifiedMode ? 1 : 2)];
    if (karkorReach) {
      profG
        .append('circle')
        .attr('cx', profX(karkorReach.cumulativeAreaKm2))
        .attr('cy', profY(karkorReach.binRow))
        .attr('r', 2.5)
        .attr('fill', '#f43f5e');
    }
  }, [
    bins,
    reachTotals,
    topBottlenecks,
    metricMode,
    selectedCell.col,
    selectedCell.row,
    sim.cols,
    sim.rows,
    binCols,
    binRows,
    simplifiedMode,
  ]);

  const activeBin = useMemo(() => {
    if (hoveredBin) return hoveredBin;
    const match = bins.find(
      (b) =>
        Math.abs(b.gridCol - selectedCell.col) <= (simplifiedMode ? 8 : 4) &&
        Math.abs(b.gridRow - selectedCell.row) <= (simplifiedMode ? 8 : 4)
    );
    return match || topBottlenecks[0] || bins[0];
  }, [hoveredBin, bins, selectedCell.col, selectedCell.row, topBottlenecks, simplifiedMode]);

  return (
    <div dir="rtl" className="p-4 border-b border-[#1E293B] bg-[#0B0E17] space-y-3 text-right">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold text-white">
            مصفوفة انحدار التضاريس (%) وتراكم الجريان السطحي D8
          </h3>
          <p className="text-[11px] text-slate-400">
            ارتباط عكسي (r = {sim.slopeFlowMetrics.pearsonR}) بين نسبة الانحدار وتجمع السيول (انقر لتفعيل الطبقة)
          </p>
        </div>

        {/* Clean Segmented Control */}
        <div className="flex items-center bg-[#111827] p-0.5 border border-[#1E293B] text-[10px] font-mono shrink-0">
          <button
            type="button"
            onClick={() => {
              setMetricMode('slopePct');
              onSelectLayerRef.current?.('slope');
            }}
            className={`px-1.5 py-1 whitespace-nowrap ${
              metricMode === 'slopePct'
                ? 'bg-emerald-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الانحدار %
          </button>
          <button
            type="button"
            onClick={() => {
              setMetricMode('flowAcc');
              onSelectLayerRef.current?.('flowAcc');
            }}
            className={`px-1.5 py-1 whitespace-nowrap ${
              metricMode === 'flowAcc'
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            التراكم D8
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('bottleneck')}
            className={`px-1.5 py-1 whitespace-nowrap ${
              metricMode === 'bottleneck'
                ? 'bg-amber-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            الاختناق
          </button>
        </div>
      </div>

      {/* Scientific Definition Note */}
      <div className="p-2 bg-[#07090E] border border-[#1E293B] text-[10.5px] text-slate-300 leading-relaxed">
        <span className="text-emerald-300 font-semibold">العلاقة الطبوغرافية (S% = tan β × 100%): </span>
        ينحدر الجرف الغربي بنسبة <strong className="text-amber-300">{sim.slopeFlowMetrics.meanScarpSlopePct}%</strong> فيسرّع السيول نحو قاع الغاب المستوي (<strong className="text-emerald-300">{sim.slopeFlowMetrics.meanValleySlopePct}%</strong>) حيث يتركز <strong className="text-sky-300">{sim.slopeFlowMetrics.flatValleyPondingPct}%</strong> من التراكم المائي الأقصى.
      </div>

      {/* D3 SVG Matrix & Longitudinal Curve */}
      <div
        dir="ltr"
        className="pt-1"
        onMouseLeave={() => {
          if (!simplifiedMode) setHoveredBin(null);
        }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 322 224"
          className="orontes-chart-svg w-full h-auto block select-none"
        />

        {/* Color Scale Legend Bar */}
        <div dir="rtl" className="pt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
          <span>
            {metricMode === 'slopePct'
              ? 'قاع مستوٍ (<1.5%) + ركود'
              : metricMode === 'flowAcc'
              ? 'جريان سفحي منخفض'
              : 'جريان حرّ منتظم'}
          </span>
          <div
            className="flex-1 h-1.5 border border-slate-700"
            style={{
              background:
                metricMode === 'slopePct'
                  ? 'linear-gradient(270deg, #0284c7 0%, #064e3b 18%, #10b981 38%, #eab308 65%, #ea580c 85%, #f8fafc 100%)'
                  : metricMode === 'flowAcc'
                  ? 'linear-gradient(270deg, #090d16 0%, #172554 25%, #0284c7 52%, #22d3ee 74%, #facc15 88%, #f43f5e 100%)'
                  : 'linear-gradient(270deg, #090d16 0%, #1e293b 30%, #0f766e 55%, #eab308 78%, #e11d48 100%)',
            }}
          />
          <span className={metricMode === 'slopePct' ? 'text-orange-400' : 'text-rose-400'}>
            {metricMode === 'slopePct' ? 'جرف حاد (>35%)' : 'اختناق مائي حرج'}
          </span>
        </div>
      </div>

      {/* Live Hovered / Selected Bin Telemetry Readout */}
      {activeBin && (
        <div className="pt-2.5 border-t border-[#1E293B] font-mono text-[11px] tabular-nums space-y-1">
          <div className="flex items-center justify-between text-slate-200 font-semibold">
            <span>
              المسافة شمالاً: {activeBin.reachKm.toFixed(1)} كم · شرقاً: {activeBin.crossKm.toFixed(1)} كم
            </span>
            <span
              className={
                activeBin.meanSlopePct < 1.5 && activeBin.cumulativeFlowCells >= 120
                  ? 'text-sky-300'
                  : activeBin.isBottleneck
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }
            >
              {activeBin.meanSlopePct < 1.5 && activeBin.cumulativeFlowCells >= 120
                ? '◆ حوض ركود وتراكم (<1.5%)'
                : activeBin.isBottleneck
                ? '▲ اختناق تصريف حرج'
                : '● انحدار تصريف نشط'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px]">
            <div className="flex justify-between">
              <span className="text-slate-400">نسبة الانحدار (Slope %)</span>
              <span className="text-emerald-300 font-semibold">
                {activeBin.meanSlopePct.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">الخلايا المتراكمة D8</span>
              <span className="text-sky-300">
                {activeBin.cumulativeFlowCells.toLocaleString()} خلية
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">مؤشر طاقة الجريان (SPI)</span>
              <span className="text-amber-300">{activeBin.meanSpi.toFixed(2)} · TWI {activeBin.meanTwi.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">المساحة الصبّابة العليا</span>
              <span className="text-white font-semibold">
                {activeBin.upslopeAreaKm2.toFixed(1)} كم²
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Primary River Bottlenecks Quick Locate */}
      <div className="pt-2 border-t border-[#1E293B]">
        <div className="text-[11px] text-slate-400 mb-1.5">
          بؤر الاختناق الهيدروليكي الرئيسية على نهر العاصي:
        </div>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10.5px] tabular-nums">
          {topBottlenecks.map((bn, idx) => {
            const label =
              bn.reachKm >= 48
                ? 'عتبة مضيق قرقور (56 كم)'
                : bn.reachKm >= 38
                ? 'اختناق الزيارة (44 كم)'
                : bn.reachKm >= 26
                ? 'مروحة شطحة (31 كم)'
                : 'سيفون قلعة المضيق (21 كم)';
            return (
              <button
                key={`${bn.binCol}-${bn.binRow}-${idx}`}
                type="button"
                onClick={() => {
                  setHoveredBin(bn);
                  onSelectCellRef.current(bn.gridCol, bn.gridRow);
                }}
                className="px-2 py-1.5 bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-right text-slate-200 hover:text-white flex items-center justify-between truncate"
                title="توسيط الخريطة على نقطة الاختناق الهيدروليكي"
              >
                <span className="truncate font-sans">{label}</span>
                <span className="text-amber-400 font-semibold mr-1 shrink-0">
                  {bn.upslopeAreaKm2.toFixed(0)} كم²
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

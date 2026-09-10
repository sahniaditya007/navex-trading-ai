'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Candle } from '@/types/trading';

interface Overlays {
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

interface CandlestickChartProps {
  candles: Candle[];
  overlays?: Overlays;
  height?: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  overlays = {},
  height = 360,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<{
    candle: Candle;
    x: number;
    y: number;
  } | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Compute EMAs
  const emaData = useMemo(() => {
    if (!candles || candles.length === 0) return { ema20: [], ema50: [] };

    const calculateEma = (period: number) => {
      const k = 2 / (period + 1);
      const ema: Array<number | null> = [];
      let prevEma: number | null = null;

      for (let i = 0; i < candles.length; i++) {
        const close = candles[i].close;
        if (i < period - 1) {
          ema.push(null);
        } else if (i === period - 1) {
          const sum = candles.slice(0, period).reduce((acc, c) => acc + c.close, 0);
          prevEma = sum / period;
          ema.push(prevEma);
        } else {
          prevEma = close * k + (prevEma as number) * (1 - k);
          ema.push(prevEma);
        }
      }
      return ema;
    };

    return {
      ema20: calculateEma(14),
      ema50: calculateEma(24),
    };
  }, [candles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || containerWidth || 600;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const paddingRight = 82;
    const paddingBottom = 26;
    const paddingTop = 16;
    const chartWidth = Math.max(10, width - paddingRight);
    const chartHeight = height - paddingBottom - paddingTop;
    const volHeight = chartHeight * 0.22;
    const priceHeight = chartHeight * 0.78;

    ctx.clearRect(0, 0, width, height);

    // Scaling
    let minPrice = Math.min(...candles.map((c) => c.low));
    let maxPrice = Math.max(...candles.map((c) => c.high));

    if (overlays.stopLoss) minPrice = Math.min(minPrice, overlays.stopLoss);
    if (overlays.takeProfit) maxPrice = Math.max(maxPrice, overlays.takeProfit);
    if (overlays.entry) {
      minPrice = Math.min(minPrice, overlays.entry);
      maxPrice = Math.max(maxPrice, overlays.entry);
    }

    const priceRange = maxPrice - minPrice || 1.0;
    const buffer = priceRange * 0.06;
    const scaledMin = minPrice - buffer;
    const scaledMax = maxPrice + buffer;
    const totalRange = scaledMax - scaledMin;

    const priceToY = (p: number) => paddingTop + priceHeight * (1 - (p - scaledMin) / totalRange);

    const maxVol = Math.max(...candles.map((c) => c.volume)) || 1.0;
    const volToHeight = (v: number) => (v / maxVol) * volHeight;

    const step = chartWidth / candles.length;
    const barWidth = Math.max(2, step * 0.68);

    // Background Horizontal Grid
    ctx.strokeStyle = 'rgba(35, 37, 42, 0.8)';
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
      const y = paddingTop + (priceHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const priceVal = scaledMax - (totalRange / 4) * i;
      ctx.fillStyle = '#8a8f98';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`$${priceVal.toFixed(1)}`, chartWidth + 8, y + 4);
    }

    // Volume boundary divider
    const volDividerY = paddingTop + priceHeight;
    ctx.strokeStyle = 'rgba(35, 37, 42, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, volDividerY);
    ctx.lineTo(chartWidth, volDividerY);
    ctx.stroke();

    // Render Candles & Volume
    candles.forEach((c, i) => {
      const x = i * step + step / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? '#27a644' : '#eb5757';

      // Volume histogram
      const vH = volToHeight(c.volume);
      const vY = paddingTop + priceHeight + volHeight - vH;
      ctx.fillStyle = isUp ? 'rgba(39, 166, 68, 0.22)' : 'rgba(235, 87, 87, 0.22)';
      ctx.fillRect(x - barWidth / 2, vY, barWidth, vH);

      // High-Low Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(c.high));
      ctx.lineTo(x, priceToY(c.low));
      ctx.stroke();

      // Body
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    });

    // Draw EMA 20 (Signal Teal)
    const drawEma = (emaArray: Array<number | null>, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;

      emaArray.forEach((val, i) => {
        if (val === null) return;
        const x = i * step + step / 2;
        const y = priceToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };

    drawEma(emaData.ema20, '#02b8cc');
    drawEma(emaData.ema50, '#8b5cf6');

    // Draw Overlays (Entry, SL, TP)
    const drawOverlayLine = (level: number, label: string, color: string, isDashed = true) => {
      const y = priceToY(level);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      if (isDashed) ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Right-hand badge
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.fillRect(chartWidth + 2, y - 9, 78, 18);
      ctx.fillStyle = '#08090a';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${label} $${level.toFixed(0)}`, chartWidth + 41, y + 3.5);
      ctx.restore();
    };

    if (overlays.entry) drawOverlayLine(overlays.entry, 'ENTRY', '#d0d6e0');
    if (overlays.stopLoss) drawOverlayLine(overlays.stopLoss, 'SL', '#eb5757');
    if (overlays.takeProfit) drawOverlayLine(overlays.takeProfit, 'TP', '#27a644');
  }, [candles, overlays, emaData, height, containerWidth]);

  // Handle pointer position for interactive crosshair
  const updateCrosshair = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const chartWidth = Math.max(10, rect.width - 82);

    if (x >= 0 && x <= chartWidth) {
      const step = chartWidth / candles.length;
      const index = Math.min(candles.length - 1, Math.max(0, Math.floor(x / step)));
      setHoveredCandle({
        candle: candles[index],
        x: index * step + step / 2,
        y,
      });
    } else {
      setHoveredCandle(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updateCrosshair(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      updateCrosshair(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredCandle(null)}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setHoveredCandle(null)}
      className="relative w-full min-w-0 overflow-hidden select-none bg-carbon rounded-[12px] p-3 sm:p-4 border border-graphite shadow-subtle"
    >
      {/* Chart Top Metadata & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-mono-linear text-[14px] text-paper font-medium">
            {candles.length > 0 ? `$${candles[candles.length - 1].close.toFixed(2)}` : '--'}
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono-linear text-fog">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-[#02b8cc]" />
              EMA 20
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-0.5 bg-[#8b5cf6]" />
              EMA 50
            </span>
          </div>
        </div>

        {/* Hover Readout */}
        {hoveredCandle ? (
          <div className="flex items-center gap-3 font-mono-linear text-[11px] text-mist">
            <span>O: ${hoveredCandle.candle.open.toFixed(1)}</span>
            <span>H: ${hoveredCandle.candle.high.toFixed(1)}</span>
            <span>L: ${hoveredCandle.candle.low.toFixed(1)}</span>
            <span>C: ${hoveredCandle.candle.close.toFixed(1)}</span>
            <span className="text-ash">Vol: {hoveredCandle.candle.volume.toFixed(0)}</span>
          </div>
        ) : (
          <span className="text-[11px] font-mono-linear text-ash">
            {candles.length} bars loaded · Hover for bar inspect
          </span>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="block cursor-crosshair"
      />
    </div>
  );
};

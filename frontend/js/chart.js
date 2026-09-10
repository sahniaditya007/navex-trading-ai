"""
Chart rendering module using HTML5 Canvas.
Renders candlesticks, volume histogram, EMA lines, and trade level overlays (Entry, SL, TP).
"""

class NavexChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.candles = [];
    this.overlays = {
      entry: null,
      stopLoss: null,
      takeProfit: null,
      ema20: null,
      ema50: null
    };
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.render();
  }

  setData(candles, overlays = {}) {
    this.candles = candles || [];
    this.overlays = { ...this.overlays, ...overlays };
    this.render();
  }

  render() {
    if (!this.canvas || !this.candles || this.candles.length === 0) return;

    const width = this.canvas.width / window.devicePixelRatio;
    const height = this.canvas.height / window.devicePixelRatio;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, width, height);

    // Layout
    const paddingRight = 75;
    const paddingBottom = 25;
    const paddingTop = 20;
    const chartWidth = width - paddingRight;
    const chartHeight = height - paddingBottom - paddingTop;
    const volHeight = chartHeight * 0.2;
    const priceHeight = chartHeight * 0.8;

    // Price scaling
    let minPrice = Math.min(...this.candles.map(c => c.low));
    let maxPrice = Math.max(...this.candles.map(c => c.high));

    // Incorporate overlays into scale
    if (this.overlays.stopLoss) minPrice = Math.min(minPrice, this.overlays.stopLoss);
    if (this.overlays.takeProfit) maxPrice = Math.max(maxPrice, this.overlays.takeProfit);

    const priceRange = maxPrice - minPrice || 1.0;
    const buffer = priceRange * 0.08;
    const scaledMin = minPrice - buffer;
    const scaledMax = maxPrice + buffer;
    const totalRange = scaledMax - scaledMin;

    const priceToY = (price) => paddingTop + priceHeight * (1 - (price - scaledMin) / totalRange);

    const maxVol = Math.max(...this.candles.map(c => c.volume)) || 1.0;
    const volToHeight = (v) => (v / maxVol) * volHeight;

    const barWidth = Math.max(2, (chartWidth / this.candles.length) * 0.7);
    const step = chartWidth / this.candles.length;

    // Background Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = paddingTop + (priceHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      const priceVal = scaledMax - (totalRange / 4) * i;
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`$${priceVal.toFixed(1)}`, chartWidth + 8, y + 4);
    }

    // Render Candles & Volume
    this.candles.forEach((c, i) => {
      const x = i * step + step / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? "#10b981" : "#ef4444";

      // Volume bar
      const vH = volToHeight(c.volume);
      ctx.fillStyle = isUp ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)";
      ctx.fillRect(x - barWidth / 2, height - paddingBottom - vH, barWidth, vH);

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(c.high));
      ctx.lineTo(x, priceToY(c.low));
      ctx.stroke();

      // Body
      const yOpen = priceToY(c.open);
      const yClose = priceToY(c.close);
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2, Math.abs(yClose - yOpen));

      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);
    });

    // Render EMA Overlay Lines
    this.renderEma(ctx, step, priceToY, 20, "#38bdf8");
    this.renderEma(ctx, step, priceToY, 50, "#fbbf24");

    // Render Trade Level Overlays (Entry, SL, TP)
    if (this.overlays.entry) {
      this.renderLevelLine(ctx, chartWidth, priceToY(this.overlays.entry), "#3b82f6", `ENTRY: $${this.overlays.entry.toFixed(2)}`);
    }
    if (this.overlays.takeProfit) {
      this.renderLevelLine(ctx, chartWidth, priceToY(this.overlays.takeProfit), "#10b981", `TP: $${this.overlays.takeProfit.toFixed(2)}`);
    }
    if (this.overlays.stopLoss) {
      this.renderLevelLine(ctx, chartWidth, priceToY(this.overlays.stopLoss), "#ef4444", `SL: $${this.overlays.stopLoss.toFixed(2)}`);
    }
  }

  renderEma(ctx, step, priceToY, period, color) {
    if (this.candles.length < 5) return;
    const closes = this.candles.map(c => c.close);
    const k = 2 / (period + 1);
    let ema = closes[0];

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    closes.forEach((price, idx) => {
      ema = (price * k) + (ema * (1 - k));
      const x = idx * step + step / 2;
      const y = priceToY(ema);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  renderLevelLine(ctx, width, y, color, label) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    // Tag
    ctx.fillStyle = color;
    ctx.font = "bold 10px monospace";
    ctx.fillRect(width + 2, y - 10, 70, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label.split(":")[0], width + 6, y + 2);
    ctx.restore();
  }
}

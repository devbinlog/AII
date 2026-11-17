/**
 * AII Creative Engine — Particle System
 * Deterministic PRNG-based particle system using Mulberry32.
 */

import type { ParticleConfig } from "@/types/domain";

// ============================================================
// Types
// ============================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  active: boolean;
}

// ============================================================
// Star path helper
// ============================================================

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ============================================================
// Hex color utility
// ============================================================

function hexToRgb(hex: string): [number, number, number] | null {
  const cleaned = hex.replace("#", "");
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    b = parseInt(cleaned[2]! + cleaned[2]!, 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hueToRgbComponent(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgbString(h: number, s: number, l: number): string {
  const hn = h / 360, sn = s / 100, ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return `rgb(${v},${v},${v})`;
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const r = Math.round(hueToRgbComponent(p, q, hn + 1 / 3) * 255);
  const g = Math.round(hueToRgbComponent(p, q, hn) * 255);
  const bv = Math.round(hueToRgbComponent(p, q, hn - 1 / 3) * 255);
  return `rgb(${r},${g},${bv})`;
}

function applyColorAdjustments(
  hex: string,
  colorHue: number | undefined,
  colorBrightness: number | undefined,
): string {
  if (colorHue === undefined && colorBrightness === undefined) return hex;
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [baseH, s, baseL] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  let h = baseH;
  let l = baseL;
  if (colorHue !== undefined) h = (h + colorHue) % 360;
  if (colorBrightness !== undefined) l = Math.min(100, l * colorBrightness);
  return hslToRgbString(h, s, l);
}

// ============================================================
// ParticleSystem
// ============================================================

export class ParticleSystem {
  private _config: ParticleConfig;
  private _particles: Particle[];
  private _seed: number;

  constructor(config: ParticleConfig, seedBase: number) {
    this._config = config;
    this._seed = seedBase >>> 0;
    this._particles = [];
    this._initPool();
  }

  // Mulberry32 PRNG — fast deterministic float in [0, 1)
  private rng(): number {
    let t = (this._seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private _initPool(): void {
    const count = Math.min(this._config.count, 500);
    this._particles = Array.from({ length: count }, (): Particle => ({
      x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 0,
      active: false,
    }));
  }

  private _spawnParticle(p: Particle): void {
    const { speed, spread, size, lifetime } = this._config;
    const angle = this.rng() * Math.PI * 2;
    const spd = (this.rng() * 0.5 + 0.5) * speed;
    p.x = (this.rng() - 0.5) * spread;
    p.y = (this.rng() - 0.5) * spread;
    p.vx = Math.cos(angle) * spd;
    p.vy = Math.sin(angle) * spd;
    p.maxLife = lifetime * (0.5 + this.rng() * 0.5);
    p.life = p.maxLife;
    p.size = size * (0.5 + this.rng() * 0.5);
    p.active = true;
  }

  update(dt: number, targetCount: number, speedMultiplier: number): void {
    const frameScale = dt / 16.67;
    const gravity = this._config.gravity;
    const clampedTarget = Math.min(targetCount, this._particles.length);

    let spawned = 0;

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (p === undefined) continue;

      if (p.active) {
        p.vx *= 0.999;
        p.vy += gravity * frameScale;
        p.x += p.vx * speedMultiplier * frameScale;
        p.y += p.vy * speedMultiplier * frameScale;
        p.life -= dt;
        if (p.life <= 0) p.active = false;
      } else if (i < clampedTarget && spawned < 10) {
        this._spawnParticle(p);
        spawned++;
      }
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    color: string,
    colorHue: number | undefined,
    colorBrightness: number | undefined,
  ): void {
    const baseColor = applyColorAdjustments(color, colorHue, colorBrightness);

    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (p === undefined || !p.active) continue;

      const opacity = Math.max(0, Math.min(1, p.life / p.maxLife));
      const rgb = hexToRgb(baseColor.startsWith("rgb") ? "#ffffff" : baseColor);
      let fillStyle: string;

      if (baseColor.startsWith("rgb")) {
        // Already rgb string from adjustments
        fillStyle = baseColor.replace("rgb(", "rgba(").replace(")", `,${opacity})`);
      } else if (rgb) {
        fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${opacity})`;
      } else {
        fillStyle = baseColor;
      }

      ctx.fillStyle = fillStyle;

      try {
        switch (this._config.shape) {
          case "circle": {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case "square": {
            const half = p.size / 2;
            ctx.fillRect(p.x - half, p.y - half, p.size, p.size);
            break;
          }
          case "star": {
            ctx.save();
            ctx.globalAlpha *= opacity;
            ctx.fillStyle = baseColor;
            drawStar(ctx, p.x, p.y, p.size / 2, p.size / 4, 5);
            ctx.fill();
            ctx.restore();
            // Skip the normal fill since we already drew
            continue;
          }
        }
      } catch {
        // Silently skip on render errors
      }
    }
  }

  reset(): void {
    for (let i = 0; i < this._particles.length; i++) {
      const p = this._particles[i];
      if (p !== undefined) p.active = false;
    }
  }
}

'use client';

// Quartz marble-vein canvas, adapted from personalweb-v2's dark original.
// Graphite veins drifting almost imperceptibly on polished quartz. Mounted
// on the dashboard only; draws once statically under reduced motion.

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

interface Vein {
  x0: number; y0: number;   // anchors (0-1 space)
  x1: number; y1: number;
  cx: number; cy: number;   // control point base
  driftAmp: number;         // control point drift amplitude (px)
  driftFreq: number;        // radians/sec — very low
  phase: number;
  width: number;
  alpha: number;
}

function makeVeins(): Vein[] {
  // Deterministic-ish spread: 5 hairline + 4 thicker veins
  const veins: Vein[] = [];
  for (let i = 0; i < 9; i++) {
    const thick = i >= 5;
    veins.push({
      x0: Math.random() * 0.3 - 0.05,
      y0: Math.random(),
      x1: 0.75 + Math.random() * 0.3,
      y1: Math.random(),
      cx: 0.25 + Math.random() * 0.5,
      cy: Math.random(),
      driftAmp: 18 + Math.random() * 26,
      driftFreq: 0.05 + Math.random() * 0.08,
      phase: Math.random() * Math.PI * 2,
      width: thick ? 0.9 + Math.random() * 0.7 : 0.3 + Math.random() * 0.4,
      alpha: thick ? 0.04 + Math.random() * 0.015 : 0.025 + Math.random() * 0.012,
    });
  }
  return veins;
}

export default function MarbleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const veins = makeVeins();
    let raf = 0;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      for (const v of veins) {
        const dx = Math.sin(t * v.driftFreq + v.phase) * v.driftAmp;
        const dy = Math.cos(t * v.driftFreq * 0.8 + v.phase) * v.driftAmp * 0.6;
        ctx.beginPath();
        ctx.moveTo(v.x0 * w, v.y0 * h);
        ctx.quadraticCurveTo(v.cx * w + dx, v.cy * h + dy, v.x1 * w, v.y1 * h);
        ctx.strokeStyle = `rgba(28, 26, 23, ${v.alpha})`;
        ctx.lineWidth = v.width;
        ctx.stroke();
      }
    };

    if (reduce) {
      draw(0); // static single draw
    } else {
      const loop = (ms: number) => {
        draw(ms / 1000);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduce]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

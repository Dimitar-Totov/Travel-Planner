"use client";

import { useEffect, useRef } from "react";

/**
 * The hero backdrop: one full-bleed canvas of dots that loops between a flat
 * drifting lattice and a rotating dot-matrix globe (land masses, an orbiting
 * node mesh and pulsing great-circle flight routes). A cycle is
 * grid hold → morph → globe hold → morph back, ~17s with the defaults.
 *
 * The per-frame math is a straight port of the design file's canvas routine and
 * is deliberately kept verbatim. Nothing here uses React state — a single rAF
 * loop drives it, it pauses while scrolled out of view, and it never starts at
 * all when the user prefers reduced motion (one static globe frame instead).
 */

type Rgb = readonly [number, number, number];
type Vec3 = readonly [number, number, number];
type LonSpan = readonly [number, number];
type LandBand = { lat: number; spans: readonly LonSpan[] };

/** A dot knows both of its homes: the flat grid (u, v) and the sphere. */
type Dot = {
  u: number;
  v: number;
  lon: number;
  cl: number;
  sl: number;
  seed: number;
  band: boolean;
  hidden: boolean;
  isLand: boolean;
  sub: SubDot[] | null;
};
/** Extra speckle scattered inside a land dot's cell, front hemisphere only. */
type SubDot = { lon: number; cl: number; sl: number };
type MeshNode = { v: Vec3; seed: number };
type Edge = readonly [number, number];
type Arc = { a: Vec3; b: Vec3; phase: number };

type Scene = {
  dots: Dot[];
  cols: number;
  nodes: MeshNode[];
  edges: Edge[];
  arcs: Arc[];
};
type Config = {
  gridHold: number;
  globeHold: number;
  morph: number;
  density: number;
  routes: boolean;
  accent: Rgb;
  scale: number;
};

const ACCENT = "#f0c68f";
const ACCENT_RGB: Rgb = [0xf0, 0xc6, 0x8f];
const MORPH_SECONDS = 1.5;
const TILT = 0.34;
const BASE_COLS = 86;
const BASE_ROWS = 42;
const NODE_COUNT = 46;
/** Sparser dot field below this CSS width — the point set is the hot loop. */
const NARROW_WIDTH = 640;
const NARROW_DENSITY = 0.7;
/** Reduced motion draws exactly one frame; 9s lands inside the globe hold. */
const STATIC_ELAPSED = 9;
/** Clamp per-frame delta so a hidden tab or a stall can't jump the morph. */
const MAX_STEP = 0.1;

/** Coarse land mask: per latitude band, the longitude spans that are land. */
const LAND: readonly LandBand[] = [
  {
    lat: 82,
    spans: [
      [-105, -18],
      [8, 30],
      [50, 105],
    ],
  },
  {
    lat: 77,
    spans: [
      [-125, -18],
      [50, 65],
      [88, 112],
    ],
  },
  {
    lat: 72,
    spans: [
      [-135, -20],
      [18, 35],
      [60, 180],
    ],
  },
  {
    lat: 67,
    spans: [
      [-168, -60],
      [-50, -20],
      [-25, -14],
      [10, 180],
    ],
  },
  {
    lat: 62,
    spans: [
      [-170, -58],
      [-50, -42],
      [-23, -14],
      [4, 180],
    ],
  },
  {
    lat: 57,
    spans: [
      [-168, -56],
      [-8, 0],
      [5, 180],
    ],
  },
  {
    lat: 52,
    spans: [
      [-172, -152],
      [-133, -55],
      [-10, 2],
      [3, 145],
      [152, 163],
    ],
  },
  {
    lat: 47,
    spans: [
      [-126, -55],
      [-5, 40],
      [40, 135],
      [139, 146],
    ],
  },
  {
    lat: 42,
    spans: [
      [-125, -69],
      [-10, 45],
      [45, 128],
      [131, 145],
    ],
  },
  {
    lat: 37,
    spans: [
      [-123, -75],
      [-10, 45],
      [45, 122],
      [126, 142],
    ],
  },
  {
    lat: 32,
    spans: [
      [-120, -79],
      [-10, 35],
      [35, 122],
      [128, 136],
    ],
  },
  {
    lat: 27,
    spans: [
      [-115, -80],
      [-14, 35],
      [35, 122],
    ],
  },
  {
    lat: 22,
    spans: [
      [-110, -96],
      [-85, -74],
      [-17, 37],
      [38, 58],
      [60, 122],
    ],
  },
  {
    lat: 17,
    spans: [
      [-106, -88],
      [-88, -61],
      [-17, 40],
      [42, 58],
      [70, 108],
      [120, 125],
    ],
  },
  {
    lat: 12,
    spans: [
      [-95, -82],
      [-75, -60],
      [-16, 48],
      [74, 81],
      [95, 110],
      [120, 126],
    ],
  },
  {
    lat: 7,
    spans: [
      [-83, -60],
      [-12, 46],
      [79, 82],
      [97, 107],
      [120, 126],
    ],
  },
  {
    lat: 2,
    spans: [
      [-80, -50],
      [8, 44],
      [95, 119],
    ],
  },
  {
    lat: -3,
    spans: [
      [-80, -35],
      [10, 42],
      [98, 126],
      [131, 150],
    ],
  },
  {
    lat: -8,
    spans: [
      [-78, -35],
      [12, 40],
      [104, 116],
      [122, 128],
      [132, 150],
    ],
  },
  {
    lat: -13,
    spans: [
      [-76, -38],
      [13, 40],
      [126, 142],
    ],
  },
  {
    lat: -18,
    spans: [
      [-72, -38],
      [12, 36],
      [43, 49],
      [118, 147],
    ],
  },
  {
    lat: -23,
    spans: [
      [-71, -40],
      [12, 35],
      [43, 48],
      [113, 152],
    ],
  },
  {
    lat: -28,
    spans: [
      [-72, -48],
      [15, 32],
      [113, 153],
    ],
  },
  {
    lat: -33,
    spans: [
      [-72, -53],
      [17, 31],
      [115, 152],
    ],
  },
  {
    lat: -38,
    spans: [
      [-73, -57],
      [140, 149],
      [172, 178],
    ],
  },
  {
    lat: -43,
    spans: [
      [-74, -65],
      [145, 148],
      [167, 175],
    ],
  },
  { lat: -48, spans: [[-75, -67]] },
  { lat: -53, spans: [[-75, -68]] },
  { lat: -63, spans: [[-65, -55]] },
  { lat: -68, spans: [[-180, 180]] },
  { lat: -73, spans: [[-180, 180]] },
  { lat: -78, spans: [[-180, 180]] },
  { lat: -83, spans: [[-180, 180]] },
];

/** London–Rome–Tokyo, Sydney–Singapore, NYC–Paris, Rio–Dakar. */
const ROUTES: ReadonlyArray<readonly [number, number, number, number]> = [
  [51.5, -0.1, 41.9, 12.5],
  [41.9, 12.5, 35.7, 139.7],
  [-33.9, 151.2, 1.35, 103.8],
  [40.7, -74.0, 48.85, 2.35],
  [-22.9, -43.2, 14.7, -17.4],
];

function landAt(latDeg: number, lonDeg: number): boolean {
  let best = LAND[0];
  let bd = 1e9;
  for (let i = 0; i < LAND.length; i++) {
    const dd = Math.abs(LAND[i].lat - latDeg);
    if (dd < bd) {
      bd = dd;
      best = LAND[i];
    }
  }
  if (bd > 6) return false;
  let lon = lonDeg;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  for (const [from, to] of best.spans) {
    if (lon >= from && lon <= to) return true;
  }
  return false;
}

function vec(latDeg: number, lonDeg: number): Vec3 {
  const la = (latDeg * Math.PI) / 180;
  const lo = (lonDeg * Math.PI) / 180;
  return [
    Math.cos(la) * Math.sin(lo),
    Math.sin(la),
    Math.cos(la) * Math.cos(lo),
  ];
}

function ease(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function parseHex(hex: string): Rgb {
  let s = hex.replace("#", "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const n = Number.parseInt(s, 16);
  if (!Number.isFinite(n)) return ACCENT_RGB;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(c: Rgb, a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

function buildScene(density: number): Scene {
  const cols = Math.round(BASE_COLS * density);
  const rows = Math.round(BASE_ROWS * density);
  const dots: Dot[] = [];

  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    const lat = (0.5 - v) * Math.PI * 0.94;
    const latDeg = (lat * 180) / Math.PI;
    // Rows shrink toward the poles, so surplus columns are parked as `hidden`:
    // they still take part in the flat grid, then fade to nothing on the globe.
    const rowCount = Math.max(8, Math.round(cols * Math.cos(lat)));
    const off = (r % 2) * 0.5;

    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const hidden = c >= rowCount;
      const lon = ((c + off) / rowCount) * Math.PI * 2;
      const lonDeg = (lon * 180) / Math.PI - 180;

      const dot: Dot = {
        u,
        v,
        lon,
        cl: Math.cos(lat),
        sl: Math.sin(lat),
        seed: Math.random(),
        band: (r + c) % 3 === 0,
        hidden,
        isLand: hidden ? false : landAt(latDeg, lonDeg),
        sub: null,
      };
      dots.push(dot);

      if (dot.isLand) {
        const stepLat = (Math.PI * 0.94) / rows;
        const stepLon = (Math.PI * 2) / rowCount;
        dot.sub = [];
        for (let k = 0; k < 3; k++) {
          const la = lat + (Math.random() - 0.5) * stepLat * 0.9;
          const lo = lon + (Math.random() - 0.5) * stepLon * 0.9;
          if (!landAt((la * 180) / Math.PI, (lo * 180) / Math.PI - 180))
            continue;
          dot.sub.push({ lon: lo, cl: Math.cos(la), sl: Math.sin(la) });
        }
      }
    }
  }

  // Fibonacci sphere for the orbiting mesh, then wire each node to its 5
  // nearest neighbours by great-circle distance (deduped with `i < j`).
  const nodes: MeshNode[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    nodes.push({
      v: [Math.cos(th) * ring, y, Math.sin(th) * ring],
      seed: Math.random(),
    });
  }

  const edges: Edge[] = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const near: Array<[number, number]> = [];
    for (let j = 0; j < NODE_COUNT; j++) {
      if (i === j) continue;
      const a = nodes[i].v;
      const b = nodes[j].v;
      const cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      near.push([Math.acos(Math.max(-1, Math.min(1, cosine))), j]);
    }
    near.sort((p, q) => p[0] - q[0]);
    for (let k = 0; k < 5; k++) {
      if (near[k] && i < near[k][1]) edges.push([i, near[k][1]]);
    }
  }

  const arcs: Arc[] = ROUTES.map(([aLat, aLon, bLat, bLon]) => ({
    a: vec(aLat, aLon),
    b: vec(bLat, bLon),
    phase: Math.random(),
  }));

  return { dots, cols, nodes, edges, arcs };
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cfg: Config,
  w: number,
  h: number,
  el: number,
): void {
  const cycle = cfg.gridHold + cfg.globeHold + cfg.morph * 2;
  const p = el % cycle;
  let t: number;
  if (p < cfg.gridHold) t = 0;
  else if (p < cfg.gridHold + cfg.morph)
    t = ease((p - cfg.gridHold) / cfg.morph);
  else if (p < cfg.gridHold + cfg.morph + cfg.globeHold) t = 1;
  else t = 1 - ease((p - cfg.gridHold - cfg.morph - cfg.globeHold) / cfg.morph);

  // `scale` multiplies the finished radius rather than feeding into the clamp,
  // so the viewport-fit rules stay exactly as tuned and only the result grows.
  const R = cfg.scale * Math.max(150, Math.min(w * 0.25, h * 0.31, 320));
  const cx = w / 2;
  const cy = h * 0.47;
  const ry = el * 0.3;
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  const fov = R * 4.2;

  ctx.clearRect(0, 0, w, h);

  // Flat lattice — the ~48px grid, faded out as the dots lift into the sphere.
  if (t < 0.995) {
    const step = Math.max(48, (w / scene.cols) * 2.2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255,255,255,${(0.045 * (1 - t)).toFixed(3)})`;
    ctx.beginPath();
    for (let x = step / 2; x < w; x += step) {
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, h);
    }
    for (let y = step / 2; y < h; y += step) {
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(w, Math.round(y) + 0.5);
    }
    ctx.stroke();
  }

  // Atmosphere, body and rim.
  if (t > 0.01) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R * 1.5);
    g.addColorStop(0, `rgba(120,196,240,${(0.1 * t).toFixed(3)})`);
    g.addColorStop(1, "rgba(120,196,240,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createRadialGradient(
      cx - R * 0.2,
      cy - R * 0.25,
      R * 0.1,
      cx,
      cy,
      R,
    );
    body.addColorStop(0, `rgba(9,44,70,${(0.42 * t).toFixed(3)})`);
    body.addColorStop(0.75, `rgba(8,38,62,${(0.5 * t).toFixed(3)})`);
    body.addColorStop(1, `rgba(24,86,124,${(0.34 * t).toFixed(3)})`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.995, 0, Math.PI * 2);
    ctx.fill();

    const rim = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.02);
    rim.addColorStop(0, "rgba(120,205,245,0)");
    rim.addColorStop(1, `rgba(150,225,255,${(0.22 * t).toFixed(3)})`);
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(196,240,255,${(0.32 * t).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.008, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Dot field. Each dot interpolates grid → sphere on its own clock: `stag`
  // delays dots by their distance from centre so the globe forms outward.
  const stag = 0.55;
  const dots = scene.dots;
  for (let i = 0; i < dots.length; i++) {
    const pt = dots[i];
    const d = Math.min(1, Math.hypot(pt.u - 0.5, (pt.v - 0.5) * 0.6) * 2);
    let tp = t * (1 + stag) - d * stag;
    tp = tp < 0 ? 0 : tp > 1 ? 1 : tp;
    tp = ease(tp);

    const fx = pt.u * w;
    const fy = pt.v * h;
    const fdrift = Math.sin(el * 0.5 + pt.seed * 9) * 1.6;

    const lon = pt.lon + ry;
    const x3 = pt.cl * Math.sin(lon) * R;
    const y0 = -pt.sl * R;
    const z0 = pt.cl * Math.cos(lon) * R;
    const y3 = y0 * ct - z0 * st;
    const z3 = y0 * st + z0 * ct;
    const persp = fov / (fov - z3);
    const gx = cx + x3 * persp;
    const gy = cy + y3 * persp;

    const x = fx + (gx - fx) * tp;
    const y = fy + fdrift * (1 - tp) + (gy - fy) * tp;

    const depth = (z3 / R + 1) / 2;
    const front = z3 >= 0;
    let a = 0.15 + (pt.band ? 0.05 : 0);
    let ga: number;
    if (pt.hidden) ga = 0;
    else if (pt.isLand) ga = front ? 0.62 + depth * 0.38 : 0.05 + depth * 0.1;
    else ga = front ? 0.06 + depth * 0.1 : 0.015 + depth * 0.04;
    // Limb darkening: dots near the silhouette dim hard so the sphere reads round.
    const limb = Math.min(1, Math.max(0, (depth - 0.5) / 0.5));
    if (front)
      ga *= pt.isLand
        ? (0.06 + 0.94 * limb) * (0.4 + 0.6 * limb)
        : 0.06 * limb + 0.94 * limb * limb * limb;
    else ga *= 0.5;
    a = a * (1 - tp) + ga * tp;

    const gs = pt.hidden
      ? 0.6
      : pt.isLand
        ? 2 + depth * 1.6
        : 1.1 + depth * 0.5;
    const s = 2.1 * (1 - tp) + gs * tp;
    if (a <= 0.004 || s <= 0.15) continue;

    ctx.fillStyle = pt.isLand
      ? `rgba(214,246,255,${a.toFixed(3)})`
      : `rgba(150,206,240,${a.toFixed(3)})`;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);

    if (pt.sub && tp > 0.15) {
      for (let k = 0; k < pt.sub.length; k++) {
        const sp = pt.sub[k];
        const l2 = sp.lon + ry;
        const sx3 = sp.cl * Math.sin(l2) * R;
        const sy0 = -sp.sl * R;
        const sz0 = sp.cl * Math.cos(l2) * R;
        const sy3 = sy0 * ct - sz0 * st;
        const sz3 = sy0 * st + sz0 * ct;
        if (sz3 < 0) continue;
        const sd = (sz3 / R + 1) / 2;
        const sl2 = Math.min(1, Math.max(0, (sd - 0.5) / 0.5));
        const sa =
          (0.5 + sd * 0.5) * (0.06 + 0.94 * sl2) * (0.4 + 0.6 * sl2) * tp;
        if (sa < 0.02) continue;
        const spp = fov / (fov - sz3);
        const ss = 1.6 + sd * 1.2;
        ctx.fillStyle = `rgba(206,242,255,${sa.toFixed(3)})`;
        ctx.fillRect(cx + sx3 * spp - ss / 2, cy + sy3 * spp - ss / 2, ss, ss);
      }
    }
  }

  // Node mesh, orbiting a little outside the surface and slower than the globe.
  if (t > 0.2) {
    const ma = Math.min(1, (t - 0.2) / 0.6);
    const ryM = el * 0.2;
    const cm = Math.cos(ryM);
    const sm = Math.sin(ryM);
    const MR = R * 1.15;
    const proj = (v: Vec3): Vec3 => {
      const x = v[0] * cm + v[2] * sm;
      const z0 = -v[0] * sm + v[2] * cm;
      const y = v[1] * ct - z0 * st;
      const z = v[1] * st + z0 * ct;
      const persp = fov / (fov - z * MR);
      return [cx + x * MR * persp, cy + y * MR * persp, z];
    };
    const pos = scene.nodes.map((n) => proj(n.v));

    ctx.lineWidth = 0.9;
    for (let i = 0; i < scene.edges.length; i++) {
      const a = pos[scene.edges[i][0]];
      const b = pos[scene.edges[i][1]];
      const dz = (a[2] + b[2]) / 2;
      ctx.strokeStyle = rgba(cfg.accent, (dz > 0 ? 0.22 : 0.08) * ma);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    for (let i = 0; i < pos.length; i++) {
      const q = pos[i];
      const twk = 0.6 + 0.4 * Math.sin(el * 1.6 + scene.nodes[i].seed * 7);
      const al = (q[2] > 0 ? 0.9 : 0.32) * ma * twk;
      const s = q[2] > 0 ? 3.2 : 2.2;
      ctx.fillStyle = rgba(cfg.accent, al);
      ctx.fillRect(q[0] - s / 2, q[1] - s / 2, s, s);
      if (q[2] > 0) {
        const glow = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], s * 3);
        glow.addColorStop(0, rgba(cfg.accent, 0.3 * ma * twk));
        glow.addColorStop(1, rgba(cfg.accent, 0));
        ctx.fillStyle = glow;
        ctx.fillRect(q[0] - s * 3, q[1] - s * 3, s * 6, s * 6);
      }
    }
  }

  // Flight routes: slerp between the two endpoints, lift the midpoint off the
  // surface, and run a bright pulse along the path.
  if (cfg.routes && t > 0.35) {
    const ra = (t - 0.35) / 0.65;
    const sr = Math.sin(ry);
    const cr = Math.cos(ry);
    const proj = (v: Vec3): Vec3 => {
      const x = v[0] * cr + v[2] * sr;
      const z0 = -v[0] * sr + v[2] * cr;
      const y = v[1] * ct - z0 * st;
      const z = v[1] * st + z0 * ct;
      return [x, y, z];
    };

    for (let k = 0; k < scene.arcs.length; k++) {
      const arc = scene.arcs[k];
      const cosine = Math.max(
        -1,
        Math.min(
          1,
          arc.a[0] * arc.b[0] + arc.a[1] * arc.b[1] + arc.a[2] * arc.b[2],
        ),
      );
      const om = Math.acos(cosine);
      const so = Math.sin(om);
      const samples = 54;
      const pulse = (el * 0.22 + arc.phase) % 1;

      for (let j = 0; j <= samples; j++) {
        const f = j / samples;
        const w1 = so > 1e-4 ? Math.sin((1 - f) * om) / so : 1 - f;
        const w2 = so > 1e-4 ? Math.sin(f * om) / so : f;
        const lift = 1 + 0.16 * Math.sin(Math.PI * f);
        const q = proj([
          (arc.a[0] * w1 + arc.b[0] * w2) * lift,
          (arc.a[1] * w1 + arc.b[1] * w2) * lift,
          (arc.a[2] * w1 + arc.b[2] * w2) * lift,
        ]);
        if (q[2] < -0.12) continue;
        const persp = fov / (fov - q[2] * R);
        const sx = cx + q[0] * R * persp;
        const sy = cy + q[1] * R * persp;
        const near = Math.max(0, 1 - Math.abs(f - pulse) * 9);
        const base = 0.26 * ra * (q[2] > 0 ? 1 : 0.35);
        const size = 1.5 + near * 2.6;
        ctx.fillStyle = rgba(cfg.accent, base + near * 0.62 * ra);
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
      }

      for (const endpoint of [arc.a, arc.b]) {
        const q = proj(endpoint);
        if (q[2] < 0) continue;
        const persp = fov / (fov - q[2] * R);
        const sx = cx + q[0] * R * persp;
        const sy = cy + q[1] * R * persp;
        ctx.fillStyle = rgba(cfg.accent, 0.9 * ra);
        ctx.fillRect(sx - 2, sy - 2, 4, 4);
        ctx.strokeStyle = rgba(cfg.accent, 0.3 * ra);
        ctx.lineWidth = 1;
        const pr = 5 + (5 * (1 + Math.sin(el * 2.2))) / 2;
        ctx.beginPath();
        ctx.arc(sx, sy, pr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Scrim behind the headline — heavy over the flat grid, lighter over the globe.
  // The globe-phase floor is raised above the design file's 0.1: the land dots
  // run straight through the sub-headline, and 0.1 doesn't hold them back.
  const shA = 0.5 * (1 - t) + 0.24 * t;
  // Radius tracks the globe as well as the viewport. `R` has a 150px floor, so
  // a purely width-derived radius (the design file's `min(w * .26, 400)`) would
  // collapse on phones and leave the copy unprotected while the globe stayed
  // large. `w * .26` only takes over again from ~1384px up; between there and
  // ~600px this runs up to ~30% wider than the design file, which is intended —
  // the globe is proportionally larger against the copy at those widths too.
  // The cap scales with the globe as well, or it would stop tracking `R` the
  // moment a scaled-up globe pushed past the unscaled 400px ceiling.
  const shR = Math.min(Math.max(w * 0.26, R * 1.35), 400 * cfg.scale);
  const sh = ctx.createRadialGradient(w / 2, h * 0.4, 20, w / 2, h * 0.4, shR);
  sh.addColorStop(0, `rgba(15,68,101,${shA.toFixed(3)})`);
  sh.addColorStop(1, "rgba(15,68,101,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, w, h);
}

type HeroGlobeProps = {
  /** Colour of the node mesh and the flight routes. */
  accent?: string;
  /** Seconds the flat grid holds before morphing. */
  gridSeconds?: number;
  /** Seconds the globe holds before morphing back. */
  globeSeconds?: number;
  /** Multiplier on the base 86×42 dot field. */
  density?: number;
  /** Draw the pulsing great-circle routes. */
  showRoutes?: boolean;
  /** Multiplier on the fitted globe radius. 1 is the tuned hero size; the auth
   *  pages run larger because there's no headline to make room for. */
  scale?: number;
};

export default function HeroGlobe({
  accent = ACCENT,
  gridSeconds = 6,
  globeSeconds = 8,
  density = 1,
  showRoutes = true,
  scale = 1,
}: HeroGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Survives effect re-runs so a prop change doesn't rewind the cycle.
  const elapsedRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cfg: Config = {
      gridHold: Math.max(1, gridSeconds),
      globeHold: Math.max(2, globeSeconds),
      morph: MORPH_SECONDS,
      density,
      routes: showRoutes,
      accent: parseHex(accent),
      scale: scale > 0 ? scale : 1,
    };

    let scene: Scene | null = null;
    let sceneDensity = 0;
    let width = 0;
    let height = 0;
    let backing = "";
    let frame: number | null = null;
    let lastTs: number | null = null;
    let visible = true;
    let disposed = false;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Driven by the ResizeObserver only, so the frame loop never reads layout.
    const measure = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (width === 0 || height === 0) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = `${width}x${height}@${dpr}`;
      if (next !== backing) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        backing = next;
      }

      const wanted = cfg.density * (width < NARROW_WIDTH ? NARROW_DENSITY : 1);
      if (!scene || sceneDensity !== wanted) {
        scene = buildScene(wanted);
        sceneDensity = wanted;
      }
    };

    const render = (el: number) => {
      if (!scene || width === 0 || height === 0) return;
      drawScene(ctx, scene, cfg, width, height, el);
    };

    const loop = (ts: number) => {
      frame = requestAnimationFrame(loop);
      // Time accrues only while the loop runs, so pausing offscreen resumes the
      // morph exactly where it left off instead of snapping forward.
      const dt = lastTs === null ? 0 : Math.min((ts - lastTs) / 1000, MAX_STEP);
      lastTs = ts;
      elapsedRef.current += dt;
      render(elapsedRef.current);
    };

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      lastTs = null;
    };

    // `disposed` guards the one path that could outlive the effect: the
    // IntersectionObserver spec doesn't require `disconnect()` to drop already
    // queued entries, and a late entry here would arm a loop nothing can cancel.
    const sync = () => {
      if (disposed) return;
      if (motion.matches) {
        stop();
        // Park the clock on the frame being shown, so turning reduced motion
        // back off resumes at the globe instead of snapping to the flat grid.
        elapsedRef.current = STATIC_ELAPSED;
        render(STATIC_ELAPSED);
        return;
      }
      if (!visible) stop();
      else if (frame === null) frame = requestAnimationFrame(loop);
    };

    const resizeObserver = new ResizeObserver(() => {
      measure();
      // Resize observations are processed after animation frame callbacks, so
      // drawing here while the loop runs would double every frame of a drag.
      if (frame === null)
        render(motion.matches ? STATIC_ELAPSED : elapsedRef.current);
    });
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        sync();
      },
      { rootMargin: "120px" },
    );
    intersectionObserver.observe(canvas);

    motion.addEventListener("change", sync);
    measure();
    sync();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      motion.removeEventListener("change", sync);
    };
  }, [accent, gridSeconds, globeSeconds, density, showRoutes, scale]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block h-full w-full"
    />
  );
}

// mountain-styles.js — Cartographic mountain style data for Leonoria
// =============================================================================
// Six tiers from dramatic alpine ranges (tier 6) to barely-raised foothills
// (tier 1). Derived from reference: traditional fantasy ink-on-parchment map
// style (stipple dotwork + clean outline, no filled faces).
//
// ── Drawing model ─────────────────────────────────────────────────────────────
// Each mountain is drawn on canvas as:
//   1. Outline — the full silhouette as a closed path (no fill, or thin fill
//      for slight lit-face tint). Stroke color & width from tier.outline.
//   2. Stipple pass — random dots scattered inside the shadow region.
//      Shadow region = right of splitX AND below the ridgeline.
//      Dots get denser toward the base (y close to 0) and toward the
//      ridge edge (near splitX). Density & size from tier.stipple.
//   3. Hachure pass (tier 4+) — short diagonal strokes descending the
//      shadow slope, grouped near the steepest sections. Parameters in
//      tier.hachure (null = skip).
//   4. Snow cap (tier 5-6) — tiny white patch at tip, sized by snowFraction
//      (fraction of peak height). Fill: rgba(255,252,245,0.82).
//
// ── Profile coordinates ───────────────────────────────────────────────────────
// pts: array of [x, y] normalized control points tracing the upper silhouette
//      from left base to right base.
//   x: 0 = left edge, 1 = right edge of the bounding box
//   y: 0 = base, 1 = highest point of this mountain group
// The drawing code scales these by actual pixel width (w) and height (h).
// Catmull-Rom or quadratic spline smoothing recommended between points.
//
// splitX: the x-coordinate (0–1) where the shadow face begins.
//   Lit face  = left  of splitX (no fill beyond outline)
//   Shadow face = right of splitX (receives stippling and hachure)
//   Typically ~0.44–0.52 — the visual "ridge spine" dividing light from dark.
//
// ── Density in mountain clusters ─────────────────────────────────────────────
// To concentrate detail at the centre of a mountain range, the caller should
// assign higher tiers (5–6) to peaks whose elevation rank is in the top 30%
// of the cluster, mid tiers (3–4) to the next 40%, and tiers 1–2 to edge
// peaks and isolated foothills. This creates the natural central-dense,
// edge-sparse look visible in cartographic mountain ranges.
// =============================================================================

'use strict';

const MOUNTAIN_TIER_STYLES = [
    null, // index 0 unused — tiers are 1-indexed

    // ── TIER 1 — Gentle foothills ────────────────────────────────────────────
    // Barely-raised terrain. Very flat, smooth curves, almost no detail.
    // Equivalent to bottom rows of reference image.
    {
        tier: 1,
        label: 'foothills',
        heightRatio: 0.18,          // h / w  (very flat)
        outline: { width: 0.55, color: '#5a5048' },
        stipple: {
            density:    0.06,       // dots per px² in shadow region
            shadow:     0.55,       // splitX — shadow starts here
            dotMin:     0.4,        // min dot radius px
            dotMax:     0.8,        // max dot radius px
            opacity:    0.45,
            baseBias:   1.5,        // exponent: >1 = denser near base
        },
        hachure: null,
        snowFraction: 0,
        profiles: [
            // Single gentle hump, centred
            { pts: [[0,0],[0.25,0.55],[0.50,1.0],[0.75,0.65],[1,0]], splitX: 0.53 },
            // Two very gentle undulations
            { pts: [[0,0],[0.22,0.85],[0.40,0.62],[0.58,1.0],[0.78,0.60],[1,0]], splitX: 0.56 },
            // Asymmetric: gradual rise, steeper right drop
            { pts: [[0,0],[0.30,0.90],[0.48,1.0],[0.65,0.72],[0.85,0.28],[1,0]], splitX: 0.50 },
            // Broad low plateau shape
            { pts: [[0,0],[0.20,0.65],[0.42,0.88],[0.58,1.0],[0.75,0.82],[0.92,0.35],[1,0]], splitX: 0.55 },
            // Very wide shallow hump, right-leaning peak
            { pts: [[0,0],[0.28,0.42],[0.54,0.88],[0.70,1.0],[0.84,0.58],[1,0]], splitX: 0.57 },
            // Two gentle humps, left taller, wide valley between
            { pts: [[0,0],[0.20,0.80],[0.36,1.0],[0.52,0.55],[0.66,0.72],[0.82,0.44],[1,0]], splitX: 0.52 },
        ],
    },

    // ── TIER 2 — Low hills ───────────────────────────────────────────────────
    // Recognisable hills, single or double hump, light shadow hint only.
    // Equivalent to 5th row of reference image.
    {
        tier: 2,
        label: 'low_hills',
        heightRatio: 0.28,
        outline: { width: 0.65, color: '#565048' },
        stipple: {
            density:    0.14,
            shadow:     0.52,
            dotMin:     0.45,
            dotMax:     0.90,
            opacity:    0.52,
            baseBias:   1.8,
        },
        hachure: null,
        snowFraction: 0,
        profiles: [
            // Single rounded hill, slight right lean
            { pts: [[0,0],[0.22,0.48],[0.40,0.92],[0.54,1.0],[0.72,0.60],[1,0]], splitX: 0.51 },
            // Two humps, right slightly taller
            { pts: [[0,0],[0.24,0.82],[0.42,0.65],[0.58,1.0],[0.78,0.58],[1,0]], splitX: 0.54 },
            // Wide gradual rise, quick right fall
            { pts: [[0,0],[0.32,0.70],[0.50,1.0],[0.64,0.80],[0.84,0.28],[1,0]], splitX: 0.49 },
            // Three very low undulations
            { pts: [[0,0],[0.18,0.72],[0.35,0.55],[0.52,0.88],[0.68,1.0],[0.84,0.50],[1,0]], splitX: 0.56 },
            // Narrow pointed hill, steep on both sides
            { pts: [[0,0],[0.30,0.52],[0.46,1.0],[0.58,0.82],[0.74,0.35],[1,0]], splitX: 0.48 },
            // Three-hump ridge, middle highest, left shoulder lower
            { pts: [[0,0],[0.16,0.62],[0.30,0.80],[0.46,1.0],[0.60,0.70],[0.72,0.84],[0.86,0.42],[1,0]], splitX: 0.53 },
        ],
    },

    // ── TIER 3 — Minor peaks ─────────────────────────────────────────────────
    // Clearly mountain-shaped, 1–2 peaks, moderate shadow stipple.
    // Equivalent to 4th row of reference image.
    {
        tier: 3,
        label: 'minor_peaks',
        heightRatio: 0.40,
        outline: { width: 0.75, color: '#524c44' },
        stipple: {
            density:    0.26,
            shadow:     0.50,
            dotMin:     0.50,
            dotMax:     1.05,
            opacity:    0.58,
            baseBias:   2.0,
        },
        hachure: null,
        snowFraction: 0,
        profiles: [
            // Single peak with gentle left shoulder
            { pts: [[0,0],[0.18,0.38],[0.36,0.88],[0.50,1.0],[0.64,0.75],[0.84,0.25],[1,0]], splitX: 0.50 },
            // Two peaks, left dominant
            { pts: [[0,0],[0.28,1.0],[0.44,0.70],[0.60,0.86],[0.78,0.50],[1,0]], splitX: 0.47 },
            // Two peaks, right dominant
            { pts: [[0,0],[0.20,0.65],[0.38,0.58],[0.54,0.85],[0.68,1.0],[0.86,0.42],[1,0]], splitX: 0.53 },
            // Rounded dome with slight double-hump
            { pts: [[0,0],[0.24,0.58],[0.42,0.95],[0.54,1.0],[0.68,0.82],[0.88,0.32],[1,0]], splitX: 0.52 },
            // Three sub-peaks, wide base, central tallest
            { pts: [[0,0],[0.16,0.58],[0.30,0.85],[0.44,1.0],[0.56,0.76],[0.66,0.88],[0.80,0.55],[0.92,0.20],[1,0]], splitX: 0.50 },
            // Narrow sharp spike, minimal shoulders, tall and lean
            { pts: [[0,0],[0.26,0.48],[0.42,0.90],[0.50,1.0],[0.60,0.78],[0.74,0.30],[1,0]], splitX: 0.48 },
        ],
    },

    // ── TIER 4 — Medium peaks ────────────────────────────────────────────────
    // Clearly alpine, 2 peaks typical, angular ridgeline, hachure begins.
    // Equivalent to 3rd row of reference image.
    {
        tier: 4,
        label: 'medium_peaks',
        heightRatio: 0.52,
        outline: { width: 0.90, color: '#4e4840' },
        stipple: {
            density:    0.38,
            shadow:     0.48,
            dotMin:     0.50,
            dotMax:     1.15,
            opacity:    0.64,
            baseBias:   2.2,
        },
        hachure: {
            count:      5,          // strokes per peak
            lengthFrac: 0.20,       // stroke length as fraction of peak height
            angle:      -55,        // degrees from horizontal (negative = descends right)
            opacity:    0.28,
        },
        snowFraction: 0,
        profiles: [
            // Sharp central spike flanked by lower shoulders
            { pts: [[0,0],[0.15,0.42],[0.30,0.76],[0.44,1.0],[0.56,0.80],[0.70,0.55],[0.86,0.18],[1,0]], splitX: 0.47 },
            // Two near-equal angular peaks
            { pts: [[0,0],[0.26,1.0],[0.40,0.68],[0.56,0.88],[0.70,0.72],[0.86,0.28],[1,0]], splitX: 0.45 },
            // Steep left face, gentler right shoulder
            { pts: [[0,0],[0.22,1.0],[0.36,0.80],[0.50,0.90],[0.64,0.72],[0.82,0.35],[1,0]], splitX: 0.44 },
            // Wide base, twin peaks with small connecting saddle
            { pts: [[0,0],[0.20,0.55],[0.36,1.0],[0.50,0.70],[0.64,0.92],[0.78,0.58],[0.92,0.18],[1,0]], splitX: 0.50 },
            // Three distinct peaks, deep saddles between, very wide range
            { pts: [[0,0],[0.16,0.72],[0.28,0.94],[0.38,1.0],[0.48,0.66],[0.58,0.88],[0.68,0.72],[0.80,0.50],[0.92,0.16],[1,0]], splitX: 0.46 },
            // Very narrow pointed spire, almost vertical sides
            { pts: [[0,0],[0.32,0.38],[0.44,0.82],[0.50,1.0],[0.58,0.78],[0.68,0.35],[1,0]], splitX: 0.46 },
        ],
    },

    // ── TIER 5 — Tall peaks ──────────────────────────────────────────────────
    // Dramatic, 2–3 peaks, heavy stippling covering most of shadow face,
    // hachure strokes on steep slopes, hint of snow at tip.
    // Equivalent to 2nd row of reference image.
    {
        tier: 5,
        label: 'tall_peaks',
        heightRatio: 0.65,
        outline: { width: 1.00, color: '#4a4438' },
        stipple: {
            density:    0.52,
            shadow:     0.46,
            dotMin:     0.55,
            dotMax:     1.28,
            opacity:    0.68,
            baseBias:   2.5,
        },
        hachure: {
            count:      8,
            lengthFrac: 0.26,
            angle:      -55,
            opacity:    0.34,
        },
        snowFraction: 0.10,         // top 10% of peak height = snow cap
        profiles: [
            // Dominant central spike with right subsidiary peak
            { pts: [[0,0],[0.12,0.32],[0.26,0.70],[0.40,1.0],[0.52,0.80],[0.62,0.88],[0.74,0.60],[0.88,0.20],[1,0]], splitX: 0.44 },
            // Three peaks, middle tallest, left and right flanking
            { pts: [[0,0],[0.18,0.60],[0.28,0.76],[0.42,1.0],[0.56,0.84],[0.66,0.88],[0.78,0.55],[1,0]], splitX: 0.46 },
            // Left-leaning cluster, sweeping right descent
            { pts: [[0,0],[0.18,0.80],[0.30,1.0],[0.42,0.84],[0.54,0.90],[0.64,0.68],[0.80,0.30],[1,0]], splitX: 0.43 },
            // Jagged ridge, two near-equal peaks, small spire between them
            { pts: [[0,0],[0.20,0.68],[0.34,0.96],[0.44,0.80],[0.50,0.92],[0.58,1.0],[0.68,0.78],[0.82,0.42],[1,0]], splitX: 0.47 },
            // Three prominent sub-peaks with deep notches, asymmetric base
            { pts: [[0,0],[0.14,0.44],[0.26,0.84],[0.36,0.68],[0.44,0.96],[0.52,0.78],[0.60,1.0],[0.70,0.82],[0.82,0.38],[1,0]], splitX: 0.45 },
            // Extremely wide massif, tall right peak, stepped left terraces
            { pts: [[0,0],[0.10,0.48],[0.22,0.66],[0.32,0.58],[0.42,0.78],[0.54,0.88],[0.64,1.0],[0.74,0.80],[0.86,0.34],[1,0]], splitX: 0.49 },
        ],
    },

    // ── TIER 6 — Dramatic alpine ranges ─────────────────────────────────────
    // Maximum complexity: 3–5 peaks, heavy dense stippling, hachure across
    // full shadow face, snow cap, complex multi-spire ridgeline.
    // Equivalent to top row of reference image.
    {
        tier: 6,
        label: 'alpine_range',
        heightRatio: 0.80,
        outline: { width: 1.10, color: '#464035' },
        stipple: {
            density:    0.68,
            shadow:     0.44,
            dotMin:     0.60,
            dotMax:     1.50,
            opacity:    0.72,
            baseBias:   2.8,
        },
        hachure: {
            count:      13,
            lengthFrac: 0.30,
            angle:      -55,
            opacity:    0.38,
        },
        snowFraction: 0.18,
        profiles: [
            // Classic 3-peak alpine range, central massif dominant
            { pts: [[0,0],[0.10,0.40],[0.22,0.70],[0.32,0.86],[0.42,1.0],[0.52,0.82],[0.60,0.90],[0.68,0.70],[0.78,0.48],[0.90,0.20],[1,0]], splitX: 0.44 },
            // Four-peak ridgeline, second from left tallest
            { pts: [[0,0],[0.12,0.52],[0.24,0.80],[0.34,1.0],[0.44,0.76],[0.52,0.88],[0.60,0.74],[0.70,0.84],[0.80,0.50],[0.92,0.16],[1,0]], splitX: 0.43 },
            // Sweeping ridge, steep left ascent, long right descent
            { pts: [[0,0],[0.10,0.44],[0.20,0.62],[0.32,0.88],[0.42,1.0],[0.54,0.86],[0.62,0.92],[0.70,0.68],[0.80,0.38],[0.92,0.14],[1,0]], splitX: 0.45 },
            // Right-leaning dominant peak, complex left shoulder cluster
            { pts: [[0,0],[0.10,0.48],[0.20,0.76],[0.30,0.62],[0.40,0.84],[0.50,0.92],[0.58,1.0],[0.66,0.86],[0.74,0.72],[0.84,0.42],[0.94,0.14],[1,0]], splitX: 0.46 },
            // Five-peak complex massif, dramatic uneven skyline
            { pts: [[0,0],[0.08,0.38],[0.18,0.72],[0.26,0.56],[0.34,0.88],[0.42,1.0],[0.50,0.80],[0.58,0.92],[0.66,0.72],[0.74,0.84],[0.82,0.52],[0.92,0.16],[1,0]], splitX: 0.44 },
            // Two massive spires with sharp V-notch, very dramatic
            { pts: [[0,0],[0.12,0.46],[0.24,0.86],[0.34,1.0],[0.44,0.65],[0.52,0.68],[0.60,0.96],[0.68,0.90],[0.78,0.58],[0.90,0.18],[1,0]], splitX: 0.43 },
        ],
    },
];

// ── Tier assignment helpers ───────────────────────────────────────────────────
//
// mapHeightToTier(hFrac)
//   hFrac: normalised elevation in the mountain range (0 = just above mountain
//          threshold, 1 = highest possible peak on this map).
//   Returns a tier 1–6.
//   Use this as the default when no cluster-density logic is applied.
function mapHeightToTier(hFrac) {
    if (hFrac >= 0.82) return 6;
    if (hFrac >= 0.62) return 5;
    if (hFrac >= 0.44) return 4;
    if (hFrac >= 0.28) return 3;
    if (hFrac >= 0.14) return 2;
    return 1;
}

// clusterTier(hFrac, clusterRank)
//   hFrac:       normalised elevation (same as above)
//   clusterRank: 0–1 where 1 = centre of cluster, 0 = edge / isolated
//   Boosts tier for central peaks to create the dense-centre look.
function clusterTier(hFrac, clusterRank) {
    const base = mapHeightToTier(hFrac);
    const boost = clusterRank >= 0.7 ? 1 : clusterRank >= 0.4 ? 0 : -1;
    return Math.max(1, Math.min(6, base + boost));
}

// pickProfile(tier, seed)
//   Returns a profile object from MOUNTAIN_TIER_STYLES[tier].profiles
//   deterministically using a numeric seed.
function pickProfile(tier, seed) {
    const style = MOUNTAIN_TIER_STYLES[tier];
    if (!style) return MOUNTAIN_TIER_STYLES[1].profiles[0];
    const profiles = style.profiles;
    return profiles[((seed >>> 0) % profiles.length)];
}

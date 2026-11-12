// Overlays: labels (with a leader line), free text, counters and icons as crisp HTML on top of the 3D picture.
// Exports: makeOverlay(root, svg, show, stage) -> { update(t), boxes() }, and the pure placement helpers
//   rectsOverlap(a, b), overlapArea(a, b), labelBox(rect, size, side, gap, along, line), chooseLabelPlacement(opts), TITLE_BAND.
// Labels avoid collisions: each label picks its side once (from the picture at the moment it starts) and keeps it.
// Positions come from the 3D stage each frame (prop rectangles, projected points). Every style is set from t
// alone, so the same t always gives the same overlay. Overlays stay out of the caption zone (bottom 24%).

import { progress, ease, clamp } from './tween.js';
import { resolvePlace } from './places.js';
import { SAFE } from './camera.js';

const ICON_COLORS = { x: '#ff4b4b', check: '#3ccf63', question: '#5b8bff', warning: '#ffb52e', heart: '#ff5c93', bolt: '#ffcc33' };
const ICON_PATHS = {
  x: '<path d="M7 7l10 10M17 7L7 17" stroke="#fff" stroke-width="3.2" stroke-linecap="round" fill="none"/>',
  check: '<path d="M5.5 12.5l4.2 4.2L18.5 7.8" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  question: '<path d="M9 9.2a3 3 0 1 1 4.4 2.7c-.9.5-1.4 1.1-1.4 2.1v.6" stroke="#fff" stroke-width="2.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="18" r="1.6" fill="#fff"/>',
  warning: '<path d="M12 6.5v7" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.7" fill="#fff"/>',
  heart: '<path d="M12 18.5s-6.5-4-6.5-8.3A3.6 3.6 0 0 1 12 8.3a3.6 3.6 0 0 1 6.5 1.9c0 4.3-6.5 8.3-6.5 8.3z" fill="#fff"/>',
  bolt: '<path d="M13.2 4.5L7 13.2h4.6l-1 6.3 6.4-8.9h-4.7z" fill="#fff"/>',
};
// Titles own the top band of the frame (fractions of the height); labels stay out of it while a title is on screen.
export const TITLE_BAND = { top: 0.075, bottom: 0.19 };
const OUT = 0.2; // seconds to fade out before "until" (when it is before the shot's end)

// --- Label placement (pure functions: numbers in, numbers out; tested in tests/overlay.test.mjs) ---

export function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
export const rectsOverlap = (a, b) => overlapArea(a, b) > 0.5;

// Top-left corner of a label box of `size` ({w,h}) on one side of a prop rectangle. `along` slides it along that side.
// line: the prop is a beam or arrow, so only the middle of its rectangle is on it (the label sits beside that point).
export function labelBox(rect, size, side, gap, along = 0, line = false) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const r = line ? { x: cx, y: cy, w: 0, h: 0 } : rect;
  const dy = line ? 0 : r.h * 0.2;
  let x, y;
  if (side === 'top') { x = cx - size.w / 2 + along; y = r.y - gap - size.h; }
  else if (side === 'bottom') { x = cx - size.w / 2 + along; y = r.y + r.h + gap; }
  else if (side === 'right') { x = r.x + r.w + gap; y = cy - dy - size.h / 2 + along; }
  else { x = r.x - gap - size.w; y = cy - dy - size.h / 2 + along; }
  return { x, y, w: size.w, h: size.h };
}

// Chooses where a label goes. opts: { rect (the prop's screen rectangle), line, size {w,h}, preferred side,
//   bounds {left,right,top,bottom}, obstacles [{x,y,w,h,weight}] (other labels, texts, icons weigh 8+, other props 1), gap }.
// Tries the preferred side, then the other sides, then slides along the side and moves away; the first spot with no overlap
// wins, otherwise the least bad one. Returns { side, along, gm (gap multiplier), box, score }.
export function chooseLabelPlacement({ rect, line = false, size, preferred = 'top', bounds, obstacles = [], gap }) {
  const sides = [preferred, ...['top', 'right', 'left', 'bottom'].filter(x => x !== preferred)];
  const frame = { x: bounds.left, y: bounds.top, w: bounds.right - bounds.left, h: bounds.bottom - bounds.top };
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const target = line ? { x: cx - gap * 0.4, y: cy - gap * 0.4, w: gap * 0.8, h: gap * 0.8 } : rect;
  let best = null;
  for (const gm of [1, 1.8, 2.8]) for (const mul of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) for (const side of sides) {
    const unit = side === 'top' || side === 'bottom' ? size.w : size.h * 2.2;
    const along = mul * unit;
    const box = labelBox(rect, size, side, gap * gm, along, line);
    let score = 50 * (box.w * box.h - overlapArea(box, frame)) + 10 * overlapArea(box, target);
    for (const o of obstacles) score += (o.weight ?? 8) * overlapArea(box, o);
    if (!best || score < best.score - 1e-6) best = { side, along, gm, box, score };
    if (score <= 1) return best;
  }
  return best;
}

function formatNumber(v, decimals) {
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function makeOverlay(root, svg, show, stage) {
  const items = [];
  show.shots.forEach((shot, si) => {
    for (const a of shot.actions) {
      if (!['label', 'text', 'count', 'icon'].includes(a.do)) continue;
      const el = document.createElement('div');
      el.style.display = 'none';
      const item = { a, si, shot, el, line: null, dot: null };
      if (a.do === 'label') {
        el.className = 'ov-label';
        el.textContent = a.text;
        item.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        item.line.setAttribute('class', 'ov-leader');
        item.dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        item.dot.setAttribute('class', 'ov-dot');
        svg.append(item.line, item.dot);
      } else if (a.do === 'text') {
        el.className = `ov-text ov-${a.style}`;
        el.textContent = a.text;
      } else if (a.do === 'count') {
        el.className = 'ov-text ov-number';
        el.innerHTML = '<span class="num"></span><span class="unit"></span>';
        el.lastChild.textContent = a.unit ? ' ' + a.unit : '';
      } else {
        el.className = 'ov-icon';
        el.style.background = ICON_COLORS[a.name];
        el.innerHTML = `<svg viewBox="0 0 24 24">${ICON_PATHS[a.name]}</svg>`;
      }
      root.appendChild(el);
      items.push(item);
    }
  });

  const hide = it => { it.el.style.display = 'none'; if (it.line) { it.line.style.display = 'none'; it.dot.style.display = 'none'; } };

  // --- layout: each label's side is decided once, from the picture a moment after the label starts ---
  const natural = it => { // size of an element as laid out (display none elements are shown for a moment)
    const prev = it.el.style.display;
    it.el.style.display = 'block';
    const r = { w: it.el.offsetWidth, h: it.el.offsetHeight };
    it.el.style.display = prev;
    return r;
  };
  // A long label wraps to at most two lines, and shrinks a little rather than overflow.
  function fitLabel(it, maxW) {
    const el = it.el;
    el.style.fontSize = ''; el.style.width = ''; el.style.whiteSpace = 'nowrap'; el.style.textAlign = '';
    let size = natural(it);
    if (size.w <= maxW) return size;
    const fs0 = parseFloat(getComputedStyle(el).fontSize), h1 = size.h;
    el.style.textAlign = 'center';
    for (let k = 1; k >= 0.7; k -= 0.06) {
      el.style.fontSize = (fs0 * k).toFixed(2) + 'px'; el.style.whiteSpace = 'nowrap'; el.style.width = '';
      size = natural(it);
      if (size.w <= maxW) return size;
      const pad = el.offsetWidth - el.clientWidth + 0.6 * fs0; // border and a little slack, in px
      el.style.whiteSpace = 'normal';
      for (const w of [Math.min(maxW, size.w * 0.56 + pad), maxW]) {
        el.style.width = w.toFixed(1) + 'px';
        size = natural(it);
        if (size.h <= h1 * k + fs0 * k * 1.3) return size; // at most two lines
      }
    }
    return size;
  }
  // Where overlays of other kinds sit while this label is up (for the label to keep clear of).
  function otherBoxes(it, ctx) {
    const out = [];
    for (const o of items) {
      if (o === it || o.si !== it.si || o.a.t0 >= it.a.until || it.a.t0 >= o.a.until) continue; // not on screen together
      if (o.a.do === 'text' && o.a.style === 'title') out.push({ x: 0, y: TITLE_BAND.top * ctx.H, w: ctx.W, h: (TITLE_BAND.bottom - TITLE_BAND.top) * ctx.H, weight: 20 });
      else if (o.a.do === 'text' || o.a.do === 'count') {
        if (o.a.do === 'count') o.el.firstChild.textContent = formatNumber(o.a.to, o.a.decimals);
        const n = natural(o), fit = Math.min(1, (ctx.right - ctx.left) / Math.max(1, n.w));
        const w = n.w * fit * 1.1, h = n.h * fit * 1.1, y = o.a.pos === 'top' ? ctx.top + 2 * ctx.u : 0.4 * ctx.H;
        out.push({ x: ctx.W / 2 - w / 2, y, w, h, weight: 10 });
      } else if (o.a.do === 'icon') {
        const c = iconCenter(o, ctx);
        if (c) out.push({ x: c.x - c.size / 2, y: c.y - c.size / 2, w: c.size, h: c.size, weight: 10 });
      } else if (o.a.do === 'label' && o.place && o.place.key === ctx.key) {
        const r = stage.propRect(o.a.prop);
        if (r) out.push({ ...placedBox(r, o.place, ctx), weight: 10 });
      }
    }
    for (const pr of stage.shots[it.si].props) { // other props: a soft obstacle (a label may cover one if nothing else fits)
      if (pr.p.id === it.a.prop || pr.p.stageSpace) continue;
      const r = stage.propRect(pr.p.id);
      if (r) out.push({ x: r.x, y: r.y, w: r.w, h: r.h, weight: 1 });
    }
    return out;
  }
  function iconCenter(it, ctx) {
    const size = 13 * ctx.u;
    let cx, cy;
    if (it.a.prop) {
      const r = stage.propRect(it.a.prop);
      if (!r) return null;
      cx = r.x + r.w * 0.82; cy = r.y + r.h * 0.18;
    } else { const q = stage.project(resolvePlace(it.a.place)); cx = q.x; cy = q.y; }
    return { x: clamp(cx, ctx.left + size / 2, ctx.right - size / 2), y: clamp(cy, ctx.top + size / 2, ctx.bottom - size / 2), size };
  }
  // The label's rectangle for its decided place, kept inside the allowed area.
  function placedBox(rect, place, ctx) {
    const b = labelBox(rect, place.size, place.side, ctx.gap * place.gm, place.along, rect.line);
    b.x = clamp(b.x, ctx.left, Math.max(ctx.left, ctx.right - b.w));
    b.y = clamp(b.y, place.top, Math.max(place.top, ctx.bottom - b.h));
    return b;
  }
  // Decides side / nudge / text fit for one label and remembers it (depends only on the picture at its start time).
  function decide(it, ctx, tNow) {
    const idx = items.indexOf(it);
    for (let i = 0; i < idx; i++) { // earlier labels of the shot decide first, so this one can keep clear of them
      const o = items[i];
      if (o.a.do === 'label' && o.si === it.si && !(o.place && o.place.key === ctx.key)) decide(o, ctx, tNow);
    }
    const a = it.a, td = Math.max(a.t0, Math.min(a.t0 + 0.25, Math.min(a.until, it.shot.end) - 0.02));
    stage.render(td);
    const size = fitLabel(it, 0.5 * ctx.W);
    const rect = stage.propRect(a.prop);
    // A title on screen at any time during the label's life keeps the top band free.
    const hasTitle = items.some(o => o.si === it.si && o.a.do === 'text' && o.a.style === 'title' && o.a.t0 < a.until && a.t0 < o.a.until);
    const top = hasTitle ? Math.max(ctx.top, TITLE_BAND.bottom * ctx.H) : ctx.top;
    let place;
    if (rect) {
      const cx = rect.x + rect.w / 2;
      let preferred = a.side;
      if (preferred === 'auto') preferred = rect.w > 0.45 * ctx.W ? 'top' : cx < ctx.W / 2 ? 'right' : 'left';
      const bounds = { left: ctx.left, right: ctx.right, top, bottom: ctx.bottom };
      const c = chooseLabelPlacement({ rect, line: rect.line, size, preferred, bounds, obstacles: otherBoxes(it, ctx), gap: ctx.gap });
      place = { key: ctx.key, size, side: c.side, along: c.along, gm: c.gm, top };
    } else place = { key: ctx.key, size, side: a.side === 'auto' ? 'top' : a.side, along: 0, gm: 1, top };
    it.place = place;
    stage.render(tNow);
  }

  function update(t) {
    const W = root.clientWidth, H = root.clientHeight, u = W / 100;
    const si = stage.shotIndexAt(t);
    const top = SAFE.top * H, bottom = (1 - SAFE.bottom) * H - 1.5 * u, left = SAFE.side * W, right = W - SAFE.side * W;
    const ctx = { W, H, u, top, bottom, left, right, gap: 6 * u, key: W + 'x' + H };
    for (const it of items) {
      const a = it.a;
      if (it.si !== si || t < a.t0 || t >= a.until) { hide(it); continue; }
      const kIn = ease('out', progress(t, a.t0, a.over));
      const kOut = a.until < it.shot.end - 0.001 ? clamp((a.until - t) / OUT) : 1;
      const alpha = Math.min(kIn, kOut);
      const el = it.el;
      el.style.display = 'block';
      el.style.opacity = alpha.toFixed(3);

      if (a.do === 'text' || a.do === 'count') {
        if (a.do === 'count') {
          const k = ease('out', progress(t, a.t0, a.over));
          el.firstChild.textContent = formatNumber(a.from + (a.to - a.from) * k, a.decimals);
        }
        const y = a.pos === 'top' ? top + 2 * u : 0.4 * H;
        const pop = a.style === 'stamp' ? 1 + 0.6 * (1 - ease('back', progress(t, a.t0, 0.35))) : 0.9 + 0.1 * kIn;
        // Long text is shrunk to fit the safe width (never cut off at the frame edge).
        const fit = Math.min(1, (right - left) / Math.max(1, el.offsetWidth));
        el.style.left = '50%';
        el.style.top = y.toFixed(1) + 'px';
        el.style.transformOrigin = '50% 0';
        el.style.transform = `translate(-50%, 0) ${a.style === 'stamp' ? 'rotate(-8deg)' : ''} scale(${(pop * fit).toFixed(3)})`;
        continue;
      }

      if (a.do === 'icon') {
        const c = iconCenter(it, ctx);
        if (!c) { hide(it); continue; }
        const pop = ease('back', progress(t, a.t0, a.over));
        el.style.left = (c.x - c.size / 2).toFixed(1) + 'px';
        el.style.top = (c.y - c.size / 2).toFixed(1) + 'px';
        el.style.transform = `scale(${Math.max(0.001, pop).toFixed(3)})`;
        continue;
      }

      // Label: a pill beside the prop with a leader line to it. The side was decided once (see decide).
      const r = stage.propRect(a.prop);
      if (!r) { hide(it); continue; }
      if (!it.place || it.place.key !== ctx.key) decide(it, ctx, t);
      const pl = it.place;
      const box = placedBox(r, pl, ctx), lx = box.x, ly = box.y, lw = box.w, lh = box.h;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, side = pl.side;
      let ax, ay;
      if (r.line) { ax = cx; ay = cy; } // a beam or arrow: point at its middle, which is on the line
      else if (side === 'top') { ax = cx; ay = cy - r.h * 0.3; }
      else if (side === 'bottom') { ax = cx; ay = cy + r.h * 0.3; }
      else if (side === 'right') { ax = cx + r.w * 0.3; ay = cy - r.h * 0.2; }
      else { ax = cx - r.w * 0.3; ay = cy - r.h * 0.2; }
      ax = clamp(ax, left, right); ay = clamp(ay, top, bottom);
      // The leader ends on the label's edge that faces the prop.
      let ex, ey;
      if (side === 'top') { ex = clamp(ax, lx + lh / 2, lx + lw - lh / 2); ey = ly + lh; }
      else if (side === 'bottom') { ex = clamp(ax, lx + lh / 2, lx + lw - lh / 2); ey = ly; }
      else if (side === 'right') { ex = lx; ey = ly + lh / 2; }
      else { ex = lx + lw; ey = ly + lh / 2; }
      const drop = (1 - kIn) * 2 * u;
      el.style.left = lx.toFixed(1) + 'px';
      el.style.top = (ly + drop).toFixed(1) + 'px';
      el.style.transform = 'none';
      // The leader line draws from the prop toward the label as the label arrives.
      const lineK = kIn;
      it.line.style.display = it.dot.style.display = 'block';
      it.line.setAttribute('x1', ax.toFixed(1)); it.line.setAttribute('y1', ay.toFixed(1));
      it.line.setAttribute('x2', (ax + (ex - ax) * lineK).toFixed(1)); it.line.setAttribute('y2', (ay + (ey - ay) * lineK).toFixed(1));
      it.line.style.opacity = it.dot.style.opacity = alpha.toFixed(3);
      it.line.style.strokeWidth = (0.55 * u).toFixed(2) + 'px';
      it.dot.setAttribute('cx', ax.toFixed(1)); it.dot.setAttribute('cy', ay.toFixed(1)); it.dot.setAttribute('r', (1.1 * u).toFixed(2));
    }
  }

  // Screen boxes of the overlays visible after the last update (for __boxes).
  function boxes() {
    const base = root.getBoundingClientRect(), out = [];
    for (const it of items) {
      if (it.el.style.display === 'none') continue;
      const b = it.el.getBoundingClientRect();
      out.push({ kind: it.a.do, id: `${it.shot.id}:${it.a.path}`, x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height });
    }
    return out;
  }

  return { update, boxes };
}

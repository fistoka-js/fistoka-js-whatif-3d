// Overlays: labels (with a leader line), free text, counters and icons as crisp HTML on top of the 3D picture.
// Exports: makeOverlay(root, svg, show, stage) -> { update(t), boxes() }.
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
const OUT = 0.2; // seconds to fade out before "until" (when it is before the shot's end)

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

  function update(t) {
    const W = root.clientWidth, H = root.clientHeight, u = W / 100;
    const si = stage.shotIndexAt(t);
    const top = SAFE.top * H, bottom = (1 - SAFE.bottom) * H - 1.5 * u, left = SAFE.side * W, right = W - SAFE.side * W;
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
        let cx, cy;
        if (a.prop) {
          const r = stage.propRect(a.prop);
          if (!r) { hide(it); continue; }
          cx = r.x + r.w * 0.82; cy = r.y + r.h * 0.18;
        } else {
          const q = stage.project(resolvePlace(a.place));
          cx = q.x; cy = q.y;
        }
        const size = 13 * u;
        cx = clamp(cx, left + size / 2, right - size / 2); cy = clamp(cy, top + size / 2, bottom - size / 2);
        const pop = ease('back', progress(t, a.t0, a.over));
        el.style.left = (cx - size / 2).toFixed(1) + 'px';
        el.style.top = (cy - size / 2).toFixed(1) + 'px';
        el.style.transform = `scale(${Math.max(0.001, pop).toFixed(3)})`;
        continue;
      }

      // Label: a pill beside the prop with a leader line to it.
      const r = stage.propRect(a.prop);
      if (!r) { hide(it); continue; }
      const lw = el.offsetWidth, lh = el.offsetHeight, gap = 6 * u;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      let side = a.side;
      if (side === 'auto') side = r.w > 0.45 * W ? 'top' : cx < W / 2 ? 'right' : 'left';
      if (side === 'right' && r.x + r.w + gap + lw > right) side = 'top';
      if (side === 'left' && r.x - gap - lw < left) side = 'top';
      let lx, ly, ax, ay, ex, ey;
      if (side === 'top') {
        lx = cx - lw / 2; ly = r.y - gap - lh; ax = cx; ay = cy - r.h * 0.3;
      } else if (side === 'right') {
        lx = r.x + r.w + gap; ly = cy - r.h * 0.2 - lh / 2; ax = cx + r.w * 0.3; ay = cy - r.h * 0.2;
      } else {
        lx = r.x - gap - lw; ly = cy - r.h * 0.2 - lh / 2; ax = cx - r.w * 0.3; ay = cy - r.h * 0.2;
      }
      if (r.line) { ax = cx; ay = cy; } // a beam or arrow: point at its middle, which is on the line
      lx = clamp(lx, left, right - lw); ly = clamp(ly, top, bottom - lh);
      ax = clamp(ax, left, right); ay = clamp(ay, top, bottom);
      if (side === 'top') { ex = clamp(ax, lx + lh / 2, lx + lw - lh / 2); ey = ly + lh; }
      else if (side === 'right') { ex = lx; ey = ly + lh / 2; } else { ex = lx + lw; ey = ly + lh / 2; }
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

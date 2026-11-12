// Private copy of the wavelength colour rule (v 0 = short wave, blue ... v 1 = long wave, red), from the approved
// chameleon video (old colors.js). TODO: swap for wavelengthColor in kit/engine/palette.js once that exists.
// Exports: spectrumColor(v, target) sets a THREE.Color and returns it.

const TABLE = [[0, 0.62], [0.3, 0.38], [0.55, 0.15], [0.78, 0.07], [1, 0]];   // [v, hue]

export function spectrumHue(v) {
  v = Math.min(1, Math.max(0, v));
  for (let i = 1; i < TABLE.length; i++) {
    if (v <= TABLE[i][0]) {
      const [a, ha] = TABLE[i - 1], [b, hb] = TABLE[i];
      return ha + (hb - ha) * (v - a) / (b - a);
    }
  }
  return 0;
}

export function spectrumColor(v, target) { return target.setHSL(spectrumHue(v), 0.95, 0.47); }

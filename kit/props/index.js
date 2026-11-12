// The list of props. To add a prop: create kit/props/<name>.js (copy ball.js), then add one import line and one
// entry below. Nothing else in the engine needs to change.
// Exports: PROPS (name -> module with { meta, build }).

import * as ball from './ball.js';
import * as box from './box.js';
import * as planet from './planet.js';
import * as sun from './sun.js';
import * as particles from './particles.js';
import * as arrow from './arrow.js';
import * as beam from './beam.js';

export const PROPS = { ball, box, planet, sun, particles, arrow, beam };

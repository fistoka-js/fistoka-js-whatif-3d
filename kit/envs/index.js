// The list of environments. To add one: create kit/envs/<name>.js (copy studio.js), then add it below.
// Exports: ENVS (name -> module with { meta, build }).

import * as space from './space.js';
import * as studio from './studio.js';
import * as sky from './sky.js';
import * as underwater from './underwater.js';
import * as micro from './micro.js';
import * as lab from './lab.js';
import * as planet_surface from './planet_surface.js';

export const ENVS = { space, studio, sky, underwater, micro, lab, planet_surface };

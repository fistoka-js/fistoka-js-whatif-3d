// The catalogue: every prop, environment, action and camera option, in one object.
// Exports: catalog = { props, envs, actions, camera }. Used by the page, the validator, the docs and the tests.

import { PROPS } from '../props/index.js';
import { ENVS } from '../envs/index.js';
import { ACTIONS } from '../actions/actions.js';
import { CAMERA_FIELDS } from './camera.js';

export const catalog = { props: PROPS, envs: ENVS, actions: ACTIONS, camera: CAMERA_FIELDS };

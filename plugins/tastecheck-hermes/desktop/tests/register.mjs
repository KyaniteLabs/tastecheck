/* Preload for `node --import`: installs the resolve hook before any import. */
import { register } from 'node:module'

register('./loader.mjs', import.meta.url)

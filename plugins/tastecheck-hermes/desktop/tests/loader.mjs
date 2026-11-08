/* Resolve-hook loader: maps the plugin's two allowlisted bare specifiers to
 * the clean-room stubs, exactly the specifiers the Desktop loader rewrites. */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const HERE = pathToFileURL(resolvePath(fileURLToPath(import.meta.url), '..')).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@hermes/plugin-sdk') {
    return { url: `${HERE}/stubs/plugin-sdk.mjs`, shortCircuit: true }
  }
  if (specifier === 'react') {
    return { url: `${HERE}/stubs/react.mjs`, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

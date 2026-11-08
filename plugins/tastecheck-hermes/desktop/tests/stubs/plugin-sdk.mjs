/* Clean-room stubs for '@hermes/plugin-sdk' — see harness.test.mjs.
 * Test state hangs off globalThis.__tc (node has no window). */
export const COMPOSER_AREAS = { actions: 'composer.actions' }
export const PALETTE_AREA = 'palette'
export const GHOST_ICON_BTN = 'ghost-btn'

const tc = () => globalThis.__tc

export const host = {
  state: {
    cwd: { get: () => tc().cwd },
    /* Forward-compatible stub for the (today absent — SDK audit 2026-11-08)
     * active-file seam the plugin feature-detects. Set __tc.activeFile to an
     * absolute path to simulate a host that exposes it. */
    activeFile: { get: () => (tc().activeFile ?? null) }
  },
  notify: (m) => tc().notifies.push(String(m)),
  notifyError: (m) => tc().errors.push(String(m)),
  openWorkspace: (id, options) => {
    if (tc().openWorkspaceBroken) throw new Error('stub: openWorkspace refused')
    tc().workspaces.push({ id, options })
    return () => {}
  }
}

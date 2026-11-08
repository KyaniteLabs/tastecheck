/* Minimal react stub: createElement returns a plain tree the harness inspects.
 * Nested arrays of children flatten, like real React. */
export function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat(Infinity) }
}
export default { createElement }

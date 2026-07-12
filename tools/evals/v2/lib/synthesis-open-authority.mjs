export function createOpenAuthority(_privateStateRef) {
  return Object.freeze({ openCommittedMap() { throw new Error("opening requires committed synthesis reservation"); } });
}

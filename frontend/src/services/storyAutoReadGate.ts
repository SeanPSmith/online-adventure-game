/**
 * Local, per-mounted-adventure admission guard for automatic narration.
 * Restored snapshots are presentation state, NOT a new chapter event. The
 * initial authoritative ready snapshot establishes a baseline even when
 * sessionStorage is blocked; later revealed scenes can be auto-read once.
 * No browser audio, hidden text or server data is stored by this guard.
 */
export function createAutoReadGate() {
  let room = "";
  let hasBaseline = false;
  let baselineScene = "";
  let wasReady = false;

  return {
    observe(roomCode: string, ready: boolean, sceneIdentity: string): void {
      if (roomCode !== room) {
        room = roomCode;
        hasBaseline = false;
        baselineScene = "";
        wasReady = false;
      }
      if (!roomCode || !ready) {
        wasReady = false;
        return;
      }
      // Every restoration (including a temporary disconnect) establishes a
      // new baseline. A chapter received during the outage is historical on
      // reconnect, not a fresh auto-play event.
      if (!wasReady || !hasBaseline) {
        hasBaseline = true;
        baselineScene = sceneIdentity;
      }
      wasReady = true;
    },
    isNewScene(roomCode: string, sceneIdentity: string): boolean {
      return Boolean(roomCode && roomCode === room && hasBaseline && wasReady && sceneIdentity && sceneIdentity !== baselineScene);
    },
  };
}

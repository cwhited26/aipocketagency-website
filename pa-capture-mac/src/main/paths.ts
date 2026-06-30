// Filesystem locations. userData resolves to ~/Library/Application Support/Pocket Agent Capture
// (productName), so the queue DB lands exactly where the spec wants it.

import { app } from "electron";
import path from "node:path";
import os from "node:os";

export function userDataDir(): string {
  return app.getPath("userData");
}

export function queueDbPath(): string {
  return path.join(userDataDir(), "queue.db");
}

export function configPath(): string {
  return path.join(userDataDir(), "settings.json");
}

/** The folders the screenshot watcher monitors for new screenshots. */
export function screenshotWatchDirs(): string[] {
  const home = os.homedir();
  return [path.join(home, "Pictures", "Screenshots"), path.join(home, "Desktop")];
}

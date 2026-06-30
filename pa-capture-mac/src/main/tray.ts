// The menu-bar (tray) icon. A neutral template image macOS recolors for light/dark menu bars.
// Clicking it toggles the popover; the tooltip reflects queue + pause state.

import { Tray, nativeImage } from "electron";
import path from "node:path";
import { isCapturePaused } from "./capture/pause";
import type { UiState } from "../shared/ipc";
import log from "./logger";

export function createTray(onToggle: () => void): Tray {
  const iconPath = path.join(__dirname, "../assets/trayTemplate.png");
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    log.warn("[tray] icon not found, using empty image", { iconPath });
  } else {
    icon.setTemplateImage(true);
  }
  const tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Pocket Agent Capture");
  tray.on("click", onToggle);
  tray.on("right-click", onToggle);
  return tray;
}

export function updateTrayTooltip(tray: Tray, state: UiState): void {
  const paused = isCapturePaused(state.config.pausedUntil, new Date());
  const status = paused ? "paused" : `${state.stats.pending} queued`;
  tray.setToolTip(`Pocket Agent Capture — ${status}`);
}

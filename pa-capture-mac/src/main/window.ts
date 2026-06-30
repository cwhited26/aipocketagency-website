// The popover window — a small frameless panel anchored under the menu-bar icon. Hidden on blur so
// it behaves like a native menu-bar popover.

import { BrowserWindow, type Rectangle } from "electron";
import path from "node:path";

export function createPopoverWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 360,
    height: 580,
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void win.loadFile(path.join(__dirname, "../renderer/popover/index.html"));

  win.on("blur", () => {
    if (!win.webContents.isDevToolsOpened()) win.hide();
  });

  return win;
}

/** Center the popover horizontally under the tray icon, just below the menu bar. */
export function positionWindowUnderTray(win: BrowserWindow, trayBounds: Rectangle): void {
  const winBounds = win.getBounds();
  const x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2);
  const y = Math.round(trayBounds.y + trayBounds.height + 4);
  win.setPosition(x, y, false);
}

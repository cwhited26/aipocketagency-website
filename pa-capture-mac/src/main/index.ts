// App entry point. Boots the controller, creates the tray + popover, wires IPC, and keeps the app
// alive as a menu-bar agent (no dock icon, no quit on window close).

import { app, BrowserWindow, Tray } from "electron";
import log from "./logger";
import { AppController } from "./controller";
import { registerIpc } from "./ipc";
import { createTray, updateTrayTooltip } from "./tray";
import { createPopoverWindow, positionWindowUnderTray } from "./window";
import { IPC } from "../shared/ipc";

let controller: AppController | null = null;
let tray: Tray | null = null;
let popover: BrowserWindow | null = null;

// Single-instance: a second launch just focuses the existing one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function togglePopover(): void {
  if (!popover || !tray) return;
  if (popover.isVisible()) {
    popover.hide();
    return;
  }
  positionWindowUnderTray(popover, tray.getBounds());
  popover.show();
  popover.focus();
}

async function refreshUi(): Promise<void> {
  if (!controller) return;
  const state = await controller.getUiState();
  if (tray) updateTrayTooltip(tray, state);
  if (popover && !popover.isDestroyed()) {
    popover.webContents.send(IPC.stateChanged, state);
  }
}

app.on("second-instance", togglePopover);

// Menu-bar app: keep running when the (hidden) popover window has no visible windows.
app.on("window-all-closed", () => {
  /* intentionally do not quit */
});

app.on("before-quit", () => {
  controller?.shutdown();
});

void app.whenReady().then(() => {
  if (process.platform === "darwin") app.dock?.hide();

  controller = new AppController();
  popover = createPopoverWindow();
  tray = createTray(togglePopover);

  controller.onChange = () => {
    void refreshUi();
  };

  registerIpc(controller, () => {
    app.quit();
  });

  controller.init();
  void refreshUi();
  log.info("[app] ready");
});

// IPC handlers — the bridge between the popover renderer (via preload) and the controller. Every
// handler returns a fresh UiState so the renderer can re-render from the result of any action.

import { ipcMain } from "electron";
import { IPC, type PauseMode, type ListKind } from "../shared/ipc";
import type { AppConfig } from "./config";
import type { AppController } from "./controller";

export function registerIpc(controller: AppController, quit: () => void): void {
  ipcMain.handle(IPC.getState, () => controller.getUiState());
  ipcMain.handle(IPC.setConfig, (_event, patch: Partial<AppConfig>) => controller.setConfig(patch));
  ipcMain.handle(IPC.setToken, (_event, token: unknown) => controller.setToken(String(token ?? "")));
  ipcMain.handle(IPC.clearToken, () => controller.clearToken());
  ipcMain.handle(IPC.pause, (_event, mode: PauseMode) => controller.setPause(mode));
  ipcMain.handle(IPC.addListEntry, (_event, list: ListKind, name: string) =>
    controller.updateList(list, String(name ?? ""), "add"),
  );
  ipcMain.handle(IPC.removeListEntry, (_event, list: ListKind, name: string) =>
    controller.updateList(list, String(name ?? ""), "remove"),
  );
  ipcMain.handle(IPC.syncNow, () => controller.syncNow());
  ipcMain.handle(IPC.quit, () => {
    quit();
  });
}

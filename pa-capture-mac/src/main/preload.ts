// Preload bridge. Exposes a minimal, typed window.paCapture API to the renderer over contextIsolation
// (nodeIntegration is off). The renderer can only call these methods — no direct Node/Electron access.

import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "../shared/ipc";

const api = {
  getState: () => ipcRenderer.invoke(IPC.getState),
  setConfig: (patch: unknown) => ipcRenderer.invoke(IPC.setConfig, patch),
  setToken: (token: string) => ipcRenderer.invoke(IPC.setToken, token),
  clearToken: () => ipcRenderer.invoke(IPC.clearToken),
  pause: (mode: string) => ipcRenderer.invoke(IPC.pause, mode),
  addListEntry: (list: string, name: string) => ipcRenderer.invoke(IPC.addListEntry, list, name),
  removeListEntry: (list: string, name: string) => ipcRenderer.invoke(IPC.removeListEntry, list, name),
  syncNow: () => ipcRenderer.invoke(IPC.syncNow),
  quit: () => ipcRenderer.invoke(IPC.quit),
  onState: (callback: (state: unknown) => void) => {
    const listener = (_event: unknown, state: unknown): void => callback(state);
    ipcRenderer.on(IPC.stateChanged, listener);
  },
};

contextBridge.exposeInMainWorld("paCapture", api);

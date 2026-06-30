// The per-user PA API token (pca_…) stored in the macOS Keychain via keytar — never on disk.

import keytar from "keytar";

const SERVICE = "Pocket Agent Capture";
const ACCOUNT = "api-token";

export async function getApiToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE, ACCOUNT);
}

export async function setApiToken(token: string): Promise<void> {
  await keytar.setPassword(SERVICE, ACCOUNT, token.trim());
}

export async function clearApiToken(): Promise<boolean> {
  return keytar.deletePassword(SERVICE, ACCOUNT);
}

export async function hasApiToken(): Promise<boolean> {
  return (await getApiToken()) !== null;
}

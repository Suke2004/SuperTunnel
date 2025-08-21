const qs = <T extends HTMLElement = HTMLElement>(sel: string) =>
  document.querySelector(sel) as T | null;

const statusEl = qs<HTMLSpanElement>('#status');
const endpointEl = qs<HTMLInputElement>('#endpoint');
const tokenEl = qs<HTMLInputElement>('#token');
const connectBtn = qs<HTMLButtonElement>('#connect');
const disconnectBtn = qs<HTMLButtonElement>('#disconnect');
const localModeEl = qs<HTMLInputElement>('#localMode');
const localHostEl = qs<HTMLInputElement>('#localHost');
const localPortEl = qs<HTMLInputElement>('#localPort');
const localSchemeEl = qs<HTMLSelectElement>('#localScheme');

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: 'get_state' });
  if (statusEl) statusEl.textContent = state?.state ?? '-';
  if (endpointEl) endpointEl.value = state?.endpoint || '';
  if (localModeEl) localModeEl.checked = Boolean(state?.localMode);
  if (localHostEl) localHostEl.value = state?.localProxyHost || '';
  if (localPortEl) localPortEl.value = state?.localProxyPort != null ? String(state.localProxyPort) : '';
  if (localSchemeEl) localSchemeEl.value = state?.localProxyScheme || 'http';
}

connectBtn?.addEventListener('click', async () => {
  const endpoint = endpointEl?.value?.trim();
  const token = tokenEl?.value?.trim();
  const localMode = Boolean(localModeEl?.checked);
  const localHost = localHostEl?.value?.trim();
  const localPort = localPortEl?.value ? Number(localPortEl.value) : undefined;
  const localScheme = localSchemeEl?.value || 'http';
  if (endpoint) await chrome.runtime.sendMessage({ type: 'set_endpoint', endpoint });
  if (token) await chrome.runtime.sendMessage({ type: 'set_token', token });
  await chrome.runtime.sendMessage({ type: 'set_local_mode', enabled: localMode });
  await chrome.runtime.sendMessage({ type: 'set_local_proxy', host: localHost, port: localPort, scheme: localScheme });
  await chrome.runtime.sendMessage({ type: 'connect' });
  await refresh();
});

disconnectBtn?.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'disconnect' });
  await refresh();
});

document.addEventListener('DOMContentLoaded', refresh);



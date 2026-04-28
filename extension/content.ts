/**
 * Content script injected into the SuperTunnel dashboard page.
 * Bridges window.postMessage from the page to chrome.runtime.sendMessage
 * so the Next.js dashboard can communicate with the extension background.
 */

const SOURCE_PAGE = "supertunnel-dashboard";
const SOURCE_EXT = "supertunnel-extension";

// Signal to the page that the extension is available
window.postMessage({ source: SOURCE_EXT, type: "ready" }, "*");

// Listen for messages from the page and forward to background
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== SOURCE_PAGE) return;

  const { id, payload } = event.data;
  try {
    const response = await chrome.runtime.sendMessage(payload);
    window.postMessage({ source: SOURCE_EXT, id, response }, "*");
  } catch (err) {
    window.postMessage({ source: SOURCE_EXT, id, response: null, error: String(err) }, "*");
  }
});

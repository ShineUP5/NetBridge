const HELPER_PROTOCOL = 'netbridge://start'
const HELPER_SETUP_URL = '/helper/Setup-NetBridge-Helper.bat'
const HELPER_FLAG = 'netbridge_helper_installed'

export function helperWasInstalled() {
  try {
    return localStorage.getItem(HELPER_FLAG) === '1'
  } catch {
    return false
  }
}

export function markHelperInstalled() {
  try {
    localStorage.setItem(HELPER_FLAG, '1')
  } catch {
    // ignore
  }
}

/** Ask Windows to open the installed helper (shows UAC). */
export function launchHelperProtocol() {
  window.location.href = HELPER_PROTOCOL
}

export function downloadHelperSetup() {
  const link = document.createElement('a')
  link.href = HELPER_SETUP_URL
  link.download = 'Setup-NetBridge-Helper.bat'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Poll until helper is up, or timeout. */
export async function waitForHelper(checkHealth, { timeoutMs = 25000, intervalMs = 1500 } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const health = await checkHealth()
    if (health?.ok) {
      markHelperInstalled()
      return true
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

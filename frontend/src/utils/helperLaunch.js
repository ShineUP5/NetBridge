const HELPER_PROTOCOL = 'netbridge://start'
const HELPER_SETUP_URL = '/helper/Setup-NetBridge-Helper.bat'
const HELPER_FLAG = 'netbridge_helper_installed'
const AUTO_TRIED = 'netbridge_helper_auto_tried_session'

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

/** Ask Windows to open the installed helper (no folder browsing). */
export function launchHelperProtocol() {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = HELPER_PROTOCOL
  document.body.appendChild(iframe)
  window.setTimeout(() => {
    try {
      iframe.remove()
    } catch {
      // ignore
    }
  }, 2000)
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
export async function waitForHelper(checkHealth, { timeoutMs = 35000, intervalMs = 1200 } = {}) {
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

export function shouldAutoStartHelper() {
  try {
    if (sessionStorage.getItem(AUTO_TRIED) === '1') return false
    sessionStorage.setItem(AUTO_TRIED, '1')
    return true
  } catch {
    return true
  }
}

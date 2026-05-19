import { getPairingBadge, type PairingBadge } from "./popupStatus";

const portInput = document.querySelector<HTMLInputElement>("#port")!;
const tokenInput = document.querySelector<HTMLInputElement>("#pairingToken")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save")!;
const badgeElement = document.querySelector<HTMLSpanElement>("#pairingBadge")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;

void chrome.storage.local.get(["port", "pairingToken"]).then((stored: { port?: number; pairingToken?: string }) => {
  if (stored.port) portInput.value = String(stored.port);
  if (stored.pairingToken) tokenInput.value = stored.pairingToken;
  void refreshPairingStatus(stored.port ?? Number(portInput.value), stored.pairingToken ?? "");
});

saveButton.addEventListener("click", async () => {
  const port = Number(portInput.value);
  const pairingToken = tokenInput.value.trim();
  statusElement.textContent = "연결 중";
  renderBadge(getPairingBadge({ hasToken: Boolean(pairingToken), appReachable: false, paired: false }));
  await chrome.storage.local.set({ port, pairingToken });
  if (!pairingToken) {
    statusElement.textContent = "ClickPilot 앱에서 발급한 토큰을 입력하세요";
    return;
  }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/pair`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ClickPilot-Token": pairingToken,
      },
      body: JSON.stringify({ pairingToken }),
    });
    const badge = getPairingBadge({ hasToken: true, appReachable: true, paired: response.ok });
    renderBadge(badge);
    statusElement.textContent = badge.detail;
    if (response.ok) {
      void chrome.runtime.sendMessage({ type: "CLICKPILOT_START_POLLING" });
    }
  } catch {
    const badge = getPairingBadge({ hasToken: true, appReachable: false, paired: false });
    renderBadge(badge);
    statusElement.textContent = badge.detail;
  }
});

async function refreshPairingStatus(port: number, pairingToken: string) {
  if (!port || !pairingToken) {
    const badge = getPairingBadge({ hasToken: Boolean(pairingToken), appReachable: false, paired: false });
    renderBadge(badge);
    statusElement.textContent = badge.detail;
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}/pair/status`, {
      headers: { "X-ClickPilot-Token": pairingToken },
    });
    if (!response.ok) {
      const badge = getPairingBadge({ hasToken: true, appReachable: true, paired: false });
      renderBadge(badge);
      statusElement.textContent = badge.detail;
      return;
    }
    const status = (await response.json()) as { paired?: boolean };
    const badge = getPairingBadge({ hasToken: true, appReachable: true, paired: Boolean(status.paired) });
    renderBadge(badge);
    statusElement.textContent = badge.detail;
    if (status.paired) {
      void chrome.runtime.sendMessage({ type: "CLICKPILOT_START_POLLING" });
    }
  } catch {
    const badge = getPairingBadge({ hasToken: true, appReachable: false, paired: false });
    renderBadge(badge);
    statusElement.textContent = badge.detail;
  }
}

function renderBadge(badge: PairingBadge) {
  badgeElement.textContent = badge.label;
  badgeElement.dataset.tone = badge.tone;
}

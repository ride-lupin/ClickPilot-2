const portInput = document.querySelector<HTMLInputElement>("#port")!;
const tokenInput = document.querySelector<HTMLInputElement>("#pairingToken")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save")!;
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
  await chrome.storage.local.set({ port, pairingToken });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/pair`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ClickPilot-Token": pairingToken,
      },
      body: JSON.stringify({ pairingToken }),
    });
    statusElement.textContent = response.ok ? "연결됨" : "연결 실패";
    if (response.ok) void chrome.runtime.sendMessage({ type: "CLICKPILOT_START_POLLING" });
  } catch {
    statusElement.textContent = "연결 실패: ClickPilot 앱을 확인하세요";
  }
});

async function refreshPairingStatus(port: number, pairingToken: string) {
  if (!port || !pairingToken) {
    statusElement.textContent = "대기 중";
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:${port}/pair/status`, {
      headers: { "X-ClickPilot-Token": pairingToken },
    });
    if (!response.ok) {
      statusElement.textContent = "대기 중";
      return;
    }
    const status = (await response.json()) as { paired?: boolean };
    statusElement.textContent = status.paired ? "연결됨" : "대기 중";
    if (status.paired) void chrome.runtime.sendMessage({ type: "CLICKPILOT_START_POLLING" });
  } catch {
    statusElement.textContent = "대기 중";
  }
}

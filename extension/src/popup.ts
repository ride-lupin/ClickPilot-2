const portInput = document.querySelector<HTMLInputElement>("#port")!;
const tokenInput = document.querySelector<HTMLInputElement>("#pairingToken")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save")!;
const statusElement = document.querySelector<HTMLParagraphElement>("#status")!;

void chrome.storage.local.get(["port", "pairingToken"]).then((stored: { port?: number; pairingToken?: string }) => {
  if (stored.port) portInput.value = String(stored.port);
  if (stored.pairingToken) tokenInput.value = stored.pairingToken;
});

saveButton.addEventListener("click", async () => {
  const port = Number(portInput.value);
  const pairingToken = tokenInput.value.trim();
  await chrome.storage.local.set({ port, pairingToken });
  const response = await fetch(`http://127.0.0.1:${port}/pair`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ClickPilot-Token": pairingToken,
    },
    body: JSON.stringify({ pairingToken }),
  });
  statusElement.textContent = response.ok ? "연결됨" : "연결 실패";
});

type ChromeExecutionApi = {
  tabs: {
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  scripting: {
    executeScript: (injection: { target: { tabId: number }; files: string[] }) => Promise<unknown>;
  };
};

export async function sendExecuteStepsWithFallback(api: ChromeExecutionApi, tabId: number, steps: unknown[]): Promise<Record<string, unknown>> {
  const message = { type: "CLICKPILOT_EXECUTE_STEPS", steps };
  const firstResponse = await api.tabs.sendMessage(tabId, message).catch(() => null);
  if (firstResponse && typeof firstResponse === "object") return firstResponse as Record<string, unknown>;

  await api.scripting.executeScript({ target: { tabId }, files: ["src/content.js"] }).catch(() => undefined);
  const retryResponse = await api.tabs.sendMessage(tabId, message);
  return retryResponse && typeof retryResponse === "object" ? (retryResponse as Record<string, unknown>) : {};
}

import { describe, expect, it, vi } from "vitest";
import { runStepsInTab, sendExecuteStepsWithFallback } from "./execution";

describe("sendExecuteStepsWithFallback", () => {
  it("injects the content script and retries when the first message fails", async () => {
    const sendMessage = vi.fn().mockRejectedValueOnce(new Error("receiving end does not exist")).mockResolvedValueOnce({ status: "success" });
    const executeScript = vi.fn().mockResolvedValue(undefined);

    const result = await sendExecuteStepsWithFallback(
      {
        tabs: { sendMessage },
        scripting: { executeScript },
      },
      123,
      [],
    );

    expect(result).toEqual({ status: "success" });
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 123 }, files: ["src/content.js"] });
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe("runStepsInTab", () => {
  it("runs each step separately and waits for the tab URL before the next step", async () => {
    const step1 = { urlPattern: "https://nid.naver.com/login", selectorCandidates: [] };
    const step2 = { urlPattern: "https://www.naver.com/", selectorCandidates: [] };
    const tab = { id: 123, windowId: 456, url: "https://nid.naver.com/login" };
    const sendMessage = vi.fn().mockResolvedValue({ status: "success", clickedSteps: 1 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi
      .fn()
      .mockResolvedValueOnce({ ...tab, url: "https://nid.naver.com/login" })
      .mockResolvedValueOnce({ ...tab, url: "https://www.naver.com/" });

    const result = await runStepsInTab(
      {
        tabs: { sendMessage, get },
        scripting: { executeScript },
      },
      tab,
      [step1, step2],
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 2 });
    expect(sendMessage).toHaveBeenNthCalledWith(1, 123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [step1] });
    expect(get).toHaveBeenCalledWith(123);
    expect(sendMessage).toHaveBeenNthCalledWith(2, 123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [step2] });
  });

  it("continues when a step response is interrupted by navigation to the next step URL", async () => {
    const step1 = { urlPattern: "https://nid.naver.com/login", selectorCandidates: [] };
    const step2 = { urlPattern: "https://www.naver.com/", selectorCandidates: [] };
    const tab = { id: 123, windowId: 456, url: "https://nid.naver.com/login" };
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("The message port closed before a response was received."))
      .mockRejectedValueOnce(new Error("Could not establish connection. Receiving end does not exist."))
      .mockResolvedValueOnce({ status: "success", clickedSteps: 1 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ ...tab, url: "https://www.naver.com/" });

    const result = await runStepsInTab(
      {
        tabs: { sendMessage, get },
        scripting: { executeScript },
      },
      tab,
      [step1, step2],
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 2 });
    expect(sendMessage).toHaveBeenNthCalledWith(3, 123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [step2] });
  });

  it("reloads the tab for refresh steps before continuing to the next click", async () => {
    const refreshStep = { kind: "browserRefresh", urlPattern: "https://www.naver.com/", wait: { timeoutMs: 100, pollIntervalMs: 1 } } as const;
    const clickStep = { kind: "browserElement", urlPattern: "https://www.naver.com/", selectorCandidates: [] } as const;
    const tab = { id: 123, windowId: 456, url: "https://www.naver.com/" };
    const reload = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue({ status: "success", clickedSteps: 1 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ ...tab, url: "https://www.naver.com/" });

    const result = await runStepsInTab(
      {
        tabs: { sendMessage, get, reload },
        scripting: { executeScript },
      },
      tab,
      [refreshStep, clickStep],
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 1 });
    expect(reload).toHaveBeenCalledWith(123);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith(123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [clickStep] });
  });
});

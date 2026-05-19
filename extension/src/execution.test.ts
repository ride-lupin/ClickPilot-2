import { describe, expect, it, vi } from "vitest";
import { runFastClickInTab, runStepsInTab, sendExecuteStepsWithFallback, targetTabUrlMatches } from "./execution";

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

describe("runFastClickInTab", () => {
  it("reloads once at start before arming the content script", async () => {
    const step = { kind: "browserElement", urlPattern: "https://www.naver.com/", selectorCandidates: [] } as const;
    const tab = { id: 123, windowId: 456, url: "https://www.naver.com/" };
    const reload = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue({ status: "success", clickedSteps: 1, latencyMs: 12 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ ...tab, status: "complete" });

    const result = await runFastClickInTab(
      {
        tabs: { sendMessage, get, reload },
        scripting: { executeScript },
      },
      tab,
      [step],
      {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "onceAtStart",
        refreshIntervalMs: 500,
        maxWaitMs: 10000,
        clickWhen: { visible: true, notDisabled: true },
      },
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 1, latencyMs: 12 });
    expect(reload).toHaveBeenCalledWith(123);
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 123 }, files: ["src/content.js"] });
    expect(sendMessage).toHaveBeenCalledWith(123, {
      type: "CLICKPILOT_ARM_FAST_CLICK",
      step,
      settings: {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "onceAtStart",
        refreshIntervalMs: 500,
        maxWaitMs: 10000,
        clickWhen: { visible: true, notDisabled: true },
      },
    });
  });

  it("allows once-at-start refresh to continue on a matching target domain subpath", async () => {
    const step = { kind: "browserElement", urlPattern: "https://ride-office.kr/", selectorCandidates: [] } as const;
    const tab = { id: 123, windowId: 456, url: "https://ride-office.kr/reservations" };
    const reload = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue({ status: "success", clickedSteps: 1, latencyMs: 12 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ ...tab, status: "complete" });

    const result = await runFastClickInTab(
      {
        tabs: { sendMessage, get, reload },
        scripting: { executeScript },
      },
      tab,
      [step],
      {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "onceAtStart",
        refreshIntervalMs: 500,
        maxWaitMs: 50,
        clickWhen: { visible: true, notDisabled: true },
      },
      { pollIntervalMs: 1, timeoutMs: 100, targetUrlPattern: "*://ride-office.kr/*" },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 1, latencyMs: 12 });
    expect(reload).toHaveBeenCalledWith(123);
    expect(sendMessage).toHaveBeenCalledWith(123, {
      type: "CLICKPILOT_ARM_FAST_CLICK",
      step,
      settings: {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "onceAtStart",
        refreshIntervalMs: 500,
        maxWaitMs: 1000,
        clickWhen: { visible: true, notDisabled: true },
      },
    });
  });

  it("continues remaining browser steps after the fast click succeeds", async () => {
    const fastStep = {
      kind: "browserElement",
      urlPattern: "https://ride-office.kr/",
      selectorCandidates: [{ strategy: "text", value: "회의실 예약", confidence: 80 }],
      delayAfterMs: 1,
      wait: { timeoutMs: 100, pollIntervalMs: 1 },
    } as const;
    const openDialogStep = {
      kind: "browserElement",
      urlPattern: "https://ride-office.kr/reservations",
      selectorCandidates: [{ strategy: "text", value: "예약하기", confidence: 80 }],
      wait: { timeoutMs: 100, pollIntervalMs: 1 },
    } as const;
    const closeDialogStep = {
      kind: "browserElement",
      urlPattern: "https://ride-office.kr/reservations",
      selectorCandidates: [{ strategy: "text", value: "취소", confidence: 80 }],
      wait: { timeoutMs: 100, pollIntervalMs: 1 },
    } as const;
    const tab = { id: 123, windowId: 456, url: "https://ride-office.kr/" };
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ status: "success", clickedSteps: 1, latencyMs: 12 })
      .mockResolvedValueOnce({ status: "success", clickedSteps: 1 })
      .mockResolvedValueOnce({ status: "success", clickedSteps: 1 });
    const executeScript = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue({ ...tab, url: "https://ride-office.kr/reservations", status: "complete" });

    const result = await runFastClickInTab(
      {
        tabs: { sendMessage, get },
        scripting: { executeScript },
      },
      tab,
      [fastStep, openDialogStep, closeDialogStep],
      {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "none",
        refreshIntervalMs: 500,
        maxWaitMs: 10000,
        clickWhen: { visible: true, notDisabled: true },
      },
      { pollIntervalMs: 1, timeoutMs: 100 },
    );

    expect(result).toEqual({ status: "success", clickedSteps: 3, latencyMs: 12 });
    expect(sendMessage).toHaveBeenNthCalledWith(1, 123, {
      type: "CLICKPILOT_ARM_FAST_CLICK",
      step: fastStep,
      settings: {
        enabled: true,
        armBeforeMs: 5000,
        refreshPolicy: "none",
        refreshIntervalMs: 500,
        maxWaitMs: 10000,
        clickWhen: { visible: true, notDisabled: true },
      },
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, 123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [openDialogStep] });
    expect(sendMessage).toHaveBeenNthCalledWith(3, 123, { type: "CLICKPILOT_EXECUTE_STEPS", steps: [closeDialogStep] });
  });
});

describe("targetTabUrlMatches", () => {
  it("matches existing tabs by domain regardless of protocol, path, query, or www", () => {
    expect(targetTabUrlMatches("https://www.ride-office.kr/dashboard?tab=1", "ride-office.kr")).toBe(true);
    expect(targetTabUrlMatches("http://ride-office.kr/", "https://ride-office.kr/admin")).toBe(true);
    expect(targetTabUrlMatches("https://admin.ride-office.kr/", "ride-office.kr")).toBe(false);
  });

  it("matches app-converted domain patterns across subpaths", () => {
    expect(targetTabUrlMatches("https://ride-office.kr/members", "*://ride-office.kr/*")).toBe(true);
    expect(targetTabUrlMatches("https://ride-office.kr/members?page=1", "*://ride-office.kr/*")).toBe(true);
    expect(targetTabUrlMatches("https://admin.ride-office.kr/members", "*://ride-office.kr/*")).toBe(false);
  });
});

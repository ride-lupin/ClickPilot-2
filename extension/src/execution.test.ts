import { describe, expect, it, vi } from "vitest";
import { sendExecuteStepsWithFallback } from "./execution";

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

import { describe, expect, it } from "vitest";
import { getPairingBadge, getToolbarBadge } from "./popupStatus";

describe("getPairingBadge", () => {
  it("shows a connected badge when the stored token is paired with the app", () => {
    expect(getPairingBadge({ hasToken: true, appReachable: true, paired: true })).toEqual({
      tone: "connected",
      label: "연결됨",
      detail: "확장프로그램이 ClickPilot 앱과 연결되어 있습니다.",
    });
  });

  it("shows token and app states separately before the extension is connected", () => {
    expect(getPairingBadge({ hasToken: false, appReachable: false, paired: false }).label).toBe("토큰 미등록");
    expect(getPairingBadge({ hasToken: true, appReachable: false, paired: false }).label).toBe("앱 실행 필요");
    expect(getPairingBadge({ hasToken: true, appReachable: true, paired: false }).label).toBe("토큰 확인 필요");
  });
});

describe("getToolbarBadge", () => {
  it("shows ON on the extension icon only when connected", () => {
    expect(getToolbarBadge({ hasToken: true, appReachable: true, paired: true })).toEqual({
      text: "ON",
      backgroundColor: "#14705d",
      title: "ClickPilot - 연결됨",
    });

    expect(getToolbarBadge({ hasToken: true, appReachable: false, paired: false }).text).toBe("");
    expect(getToolbarBadge({ hasToken: true, appReachable: true, paired: false }).text).toBe("");
  });
});

export type PairingBadgeTone = "idle" | "warning" | "connected" | "error";

export type PairingBadge = {
  tone: PairingBadgeTone;
  label: string;
  detail: string;
};

type PairingBadgeInput = {
  hasToken: boolean;
  appReachable: boolean;
  paired: boolean;
};

export type ToolbarBadge = {
  text: string;
  backgroundColor: string;
  title: string;
};

export function getPairingBadge({ hasToken, appReachable, paired }: PairingBadgeInput): PairingBadge {
  if (!hasToken) {
    return {
      tone: "idle",
      label: "토큰 미등록",
      detail: "ClickPilot 앱에서 발급한 토큰을 저장하세요.",
    };
  }

  if (!appReachable) {
    return {
      tone: "error",
      label: "앱 실행 필요",
      detail: "ClickPilot 앱을 실행한 뒤 다시 확인하세요.",
    };
  }

  if (!paired) {
    return {
      tone: "warning",
      label: "토큰 확인 필요",
      detail: "앱의 pairing token과 확장프로그램에 저장된 토큰이 다릅니다.",
    };
  }

  return {
    tone: "connected",
    label: "연결됨",
    detail: "확장프로그램이 ClickPilot 앱과 연결되어 있습니다.",
  };
}

export function getToolbarBadge(input: PairingBadgeInput): ToolbarBadge {
  if (input.hasToken && input.appReachable && input.paired) {
    return {
      text: "ON",
      backgroundColor: "#14705d",
      title: "ClickPilot - 연결됨",
    };
  }

  return {
    text: "",
    backgroundColor: "#637074",
    title: "ClickPilot",
  };
}

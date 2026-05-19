import { useState } from "react";
import type { BrowserRunTarget, LoginCheckResult, ManagedBrowserProfileTarget } from "../types";

type Props = {
  target: BrowserRunTarget;
  onOpenProfile: (target: ManagedBrowserProfileTarget) => Promise<void>;
  onCheckLogin: (target: BrowserRunTarget) => Promise<LoginCheckResult>;
};

export function LoginCheckPanel({ target, onOpenProfile, onCheckLogin }: Props) {
  const [result, setResult] = useState<LoginCheckResult>({ status: "unchecked" });

  async function check() {
    setResult({ status: "checking" });
    setResult(await onCheckLogin(target));
  }

  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>실행 전 로그인 확인</h2>
        <button type="button" className="secondary-button" onClick={check}>
          로그인 상태 확인
        </button>
      </div>
      {target.mode === "managedProfile" && (
        <button type="button" className="secondary-button" onClick={() => onOpenProfile(target)}>
          로그인 확인 열기
        </button>
      )}
      {result.status === "checking" && <p className="hint">확인 중</p>}
      {result.status === "success" && <p className="success-text">로그인 확인 완료</p>}
      {result.status === "failed" && (
        <p className="error-text">
          로그인이 필요합니다
          {result.message ? ` · ${result.message}` : ""}
        </p>
      )}
    </section>
  );
}

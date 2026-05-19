import { PlugZap } from "lucide-react";
import type { BrowserBridgeStatus, CapturedBrowserElement } from "../types";

type Props = {
  status: BrowserBridgeStatus | null;
  latestCapture: CapturedBrowserElement | null;
  onStartCapture: () => void;
};

export function BrowserCapturePanel({ status, latestCapture, onStartCapture }: Props) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>브라우저 버튼 선택</h2>
        <button type="button" className="primary-button" onClick={onStartCapture}>
          <PlugZap size={16} />
          브라우저 버튼 선택
        </button>
      </div>
      <p className={status?.paired ? "success-text" : "hint"}>
        확장 프로그램 상태: {status?.paired ? "연결됨" : `대기 중 · 포트 ${status?.port ?? 27183}`}
      </p>
      <p className="hint">
        초기 내부 파일럿은 Chrome 또는 Edge 확장 화면에서 개발자 모드를 켠 뒤 `extension/dist`를 Load unpacked로 설치합니다.
      </p>
      {latestCapture && (
        <div className="capture-preview">
          <strong>{latestCapture.textHint || "캡처된 요소"}</strong>
          <span>{latestCapture.url}</span>
        </div>
      )}
    </section>
  );
}

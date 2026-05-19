import { useState } from "react";
import type { BrowserBridgeStatus, BrowserCaptureSession } from "../types";

type Props = {
  status: BrowserBridgeStatus | null;
  captureSession: BrowserCaptureSession | null;
  onRefreshToken: () => void;
};

export function BrowserCapturePanel({ status, captureSession, onRefreshToken }: Props) {
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function copyPairingToken() {
    if (!captureSession?.pairingToken) return;

    await navigator.clipboard.writeText(captureSession.pairingToken);
    setCopyMessage("Pairing token을 클립보드에 복사했습니다.");
  }

  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>확장 프로그램 연결</h2>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onRefreshToken}>
            토큰 갱신
          </button>
        </div>
      </div>
      <p className={status?.paired ? "success-text" : "hint"}>
        확장 프로그램 상태: {status?.paired ? "연결됨" : `대기 중 · 포트 ${status?.port ?? 27183}`}
      </p>
      <p className="hint">
        초기 내부 파일럿은 Chrome 또는 Edge 확장 화면에서 개발자 모드를 켠 뒤 `extension/dist`를 Load unpacked로 설치합니다.
      </p>
      {captureSession && (
        <div className="pairing-fields" aria-label="확장 프로그램 연결 정보">
          <label>
            Port
            <input readOnly value={captureSession.port} />
          </label>
          <label>
            Pairing token
            <input
              readOnly
              title="클릭하면 Pairing token을 복사합니다."
              value={captureSession.pairingToken}
              onClick={() => void copyPairingToken()}
            />
          </label>
          {copyMessage && <p className="success-text">{copyMessage}</p>}
          <p className="hint">
            확장프로그램 팝업에 위 값을 입력합니다. Pairing token은 만료되지 않으며, 앱 재시작 후에도 같은 토큰으로 연결됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

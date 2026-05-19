import { PlugZap } from "lucide-react";
import type { BrowserBridgeStatus, BrowserCaptureSession } from "../types";

type Props = {
  status: BrowserBridgeStatus | null;
  captureSession: BrowserCaptureSession | null;
  onRefreshToken: () => void;
  onRequestCapture: () => void;
};

export function BrowserCapturePanel({ status, captureSession, onRefreshToken, onRequestCapture }: Props) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>브라우저 버튼 선택</h2>
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onRefreshToken}>
            토큰 갱신
          </button>
          <button type="button" className="primary-button" onClick={onRequestCapture}>
            <PlugZap size={16} />
            브라우저 버튼 선택
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
            <input readOnly value={captureSession.pairingToken} />
          </label>
          <p className="hint">
            확장프로그램 팝업에 위 값을 입력합니다. 초기 연결 승인용 token이며, 연결 후에는 앱을 종료하거나 연결 해제할 때까지 유지됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

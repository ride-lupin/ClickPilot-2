import { MousePointer2, Trash2 } from "lucide-react";
import type { AutomationStep, CapturedBrowserElement } from "../types";

type Props = {
  steps: AutomationStep[];
  captureMessage?: string;
  latestCapture?: CapturedBrowserElement | null;
  onCaptureCoordinate: () => void;
  onDeleteStep: (index: number) => void;
};

export function StepEditor({ steps, captureMessage, latestCapture, onCaptureCoordinate, onDeleteStep }: Props) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>클릭 단계</h2>
        <button type="button" className="secondary-button" onClick={onCaptureCoordinate}>
          <MousePointer2 size={16} />
          2초 뒤 좌표 캡처
        </button>
      </div>

      {captureMessage && <p className="success-text">{captureMessage}</p>}
      {latestCapture && (
        <div className="capture-preview">
          <strong>{latestCapture.textHint || "선택한 브라우저 요소"}</strong>
          <span>{latestCapture.url}</span>
        </div>
      )}

      <ol className="step-list">
        {steps.map((step, index) => (
          <li key={`${step.kind}-${index}`} className="step-row">
            <div>
              {step.kind === "browserElement" ? (
                <>
                  <strong>{step.textHint || "브라우저 요소"}</strong>
                  <span>{step.urlPattern}</span>
                </>
              ) : (
                <>
                  <strong>{`x ${step.x} · y ${step.y}`}</strong>
                  <span>{`${step.button} · ${step.clickCount}회 · ${step.delayAfterMs}ms 후속 대기`}</span>
                </>
              )}
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label={step.kind === "browserElement" ? `단계 삭제 브라우저 ${step.textHint || step.urlPattern}` : `단계 삭제 x ${step.x} y ${step.y}`}
              onClick={() => onDeleteStep(index)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

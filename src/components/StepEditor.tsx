import { RefreshCw, Trash2 } from "lucide-react";
import type { AutomationStep } from "../types";

type Props = {
  steps: AutomationStep[];
  onDeleteStep: (index: number) => void;
  onAddRefreshStep: () => void;
};

export function StepEditor({ steps, onDeleteStep, onAddRefreshStep }: Props) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <h2>클릭 단계</h2>
        <button type="button" className="secondary-button" onClick={onAddRefreshStep}>
          <RefreshCw size={16} />
          새로고침 단계 추가
        </button>
      </div>

      <ol className="step-list">
        {steps.map((step, index) => (
          <li key={`${step.kind}-${index}`} className="step-row">
            <div>
              {step.kind === "browserElement" ? (
                <>
                  <strong>{step.textHint || "브라우저 요소"}</strong>
                  <span>{step.urlPattern}</span>
                </>
              ) : step.kind === "browserRefresh" ? (
                <>
                  <strong>새로고침</strong>
                  <span>{step.urlPattern || "현재 탭 다시 로드"}</span>
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
              aria-label={
                step.kind === "browserElement"
                  ? `단계 삭제 브라우저 ${step.textHint || step.urlPattern}`
                  : step.kind === "browserRefresh"
                    ? "단계 삭제 새로고침"
                    : `단계 삭제 x ${step.x} y ${step.y}`
              }
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

import type { AutomationTask, BrowserRunTarget } from "../types";
import { LoginCheckPanel } from "./LoginCheckPanel";
import { ScheduleEditor } from "./ScheduleEditor";
import { StepEditor } from "./StepEditor";
import type { FastClickSettings, LoginCheckResult, ManagedBrowserProfileTarget } from "../types";

type Props = {
  draft: AutomationTask;
  saveFeedback: { kind: "success" | "warning" | "error"; message: string } | null;
  onChange: (task: AutomationTask) => void;
  onSave: () => void;
  onDeleteStep: (index: number) => void;
  onAddRefreshStep: () => void;
  onOpenProfile: (target: ManagedBrowserProfileTarget) => Promise<void>;
  onCheckLogin: (target: BrowserRunTarget) => Promise<LoginCheckResult>;
};

function defaultFastClickSettings(): FastClickSettings {
  return {
    enabled: false,
    armBeforeMs: 5000,
    refreshPolicy: "onceAtStart",
    refreshIntervalMs: 500,
    maxWaitMs: 10000,
    clickWhen: { visible: true, notDisabled: true },
  };
}

export function TaskEditor({
  draft,
  saveFeedback,
  onChange,
  onSave,
  onDeleteStep,
  onAddRefreshStep,
  onOpenProfile,
  onCheckLogin,
}: Props) {
  const fastClick = draft.fastClick ?? defaultFastClickSettings();

  function updateFastClick(update: Partial<FastClickSettings>) {
    onChange({ ...draft, fastClick: { ...fastClick, ...update } });
  }

  return (
    <section className="editor-panel" aria-label="작업 편집">
      <div className="form-section">
        <label>
          작업 이름
          <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} />
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => onChange({ ...draft, enabled: event.target.checked })} />
          활성화
        </label>
        <label>
          실행 브라우저 방식
          <select
            aria-label="실행 브라우저 방식"
            value={draft.runTarget.mode}
            onChange={(event) => {
              const mode = event.target.value as "managedProfile" | "existingTab";
              onChange({
                ...draft,
                runTarget:
                  mode === "managedProfile"
                    ? { mode, browser: "chrome", profileId: "default", preopenSeconds: 30 }
                    : { mode, browser: "any", preopenSeconds: 30, tabUrlPattern: "https://", requireActiveTab: false },
              });
            }}
          >
            <option value="managedProfile" disabled>
              전용 자동화 브라우저
            </option>
            <option value="existingTab">기존에 열려 있는 브라우저 탭</option>
          </select>
          <span className="hint">전용 자동화 브라우저는 현재 비활성화되어 있습니다.</span>
        </label>
        {draft.runTarget.mode === "managedProfile" ? (
          <div className="field-grid">
            <label>
              브라우저
              <select
                value={draft.runTarget.browser}
                onChange={(event) => {
                  if (draft.runTarget.mode !== "managedProfile") return;
                  onChange({ ...draft, runTarget: { ...draft.runTarget, browser: event.target.value as "chrome" | "edge" } });
                }}
              >
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </label>
            <label>
              프로필
              <input
                value={draft.runTarget.profileId}
                onChange={(event) => {
                  if (draft.runTarget.mode !== "managedProfile") return;
                  onChange({ ...draft, runTarget: { ...draft.runTarget, profileId: event.target.value } });
                }}
              />
            </label>
          </div>
        ) : (
          <div className="field-grid">
            <label>
              대상 탭 URL 패턴
              <input
                value={draft.runTarget.tabUrlPattern}
                onChange={(event) => {
                  if (draft.runTarget.mode !== "existingTab") return;
                  onChange({ ...draft, runTarget: { ...draft.runTarget, tabUrlPattern: event.target.value } });
                }}
              />
            </label>
            <label className="inline-check">
              <input
                type="checkbox"
                checked={draft.runTarget.requireActiveTab}
                onChange={(event) => {
                  if (draft.runTarget.mode !== "existingTab") return;
                  onChange({ ...draft, runTarget: { ...draft.runTarget, requireActiveTab: event.target.checked } });
                }}
              />
              현재 활성 탭만 사용
            </label>
          </div>
        )}
      </div>
      <section className="form-section">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={fastClick.enabled}
            onChange={(event) => updateFastClick({ enabled: event.target.checked })}
            disabled={draft.runTarget.mode !== "existingTab"}
          />
          선착순 모드 사용
        </label>
        {fastClick.enabled && (
          <div className="field-grid">
            <label>
              새로고침 방식
              <select
                value={fastClick.refreshPolicy}
                onChange={(event) => updateFastClick({ refreshPolicy: event.target.value as FastClickSettings["refreshPolicy"] })}
              >
                <option value="none">새로고침 안 함</option>
                <option value="onceAtStart">시작 시간에 1회 새로고침</option>
                <option value="repeatAfterStart">시작 시간 이후 반복 새로고침</option>
              </select>
            </label>
            <label>
              최대 대기 시간(ms)
              <input
                type="number"
                min={1000}
                max={120000}
                step={500}
                value={fastClick.maxWaitMs}
                onChange={(event) => updateFastClick({ maxWaitMs: Number(event.target.value) })}
              />
            </label>
            <label>
              반복 새로고침 간격(ms)
              <input
                type="number"
                min={500}
                max={10000}
                step={100}
                value={fastClick.refreshIntervalMs}
                onChange={(event) => updateFastClick({ refreshIntervalMs: Number(event.target.value) })}
              />
            </label>
            <label>
              텍스트 포함 조건
              <input
                value={fastClick.clickWhen.textIncludes ?? ""}
                onChange={(event) =>
                  updateFastClick({
                    clickWhen: { ...fastClick.clickWhen, textIncludes: event.target.value || undefined },
                  })
                }
              />
            </label>
          </div>
        )}
      </section>
      <ScheduleEditor value={draft.schedule} onChange={(schedule) => onChange({ ...draft, schedule })} />
      <StepEditor
        steps={draft.steps}
        onDeleteStep={onDeleteStep}
        onAddRefreshStep={onAddRefreshStep}
      />
      <LoginCheckPanel target={draft.runTarget} onOpenProfile={onOpenProfile} onCheckLogin={onCheckLogin} />
      {saveFeedback && <p className={`save-feedback ${saveFeedback.kind}`}>{saveFeedback.message}</p>}
      <div className="editor-actions">
        <button type="button" className="primary-button save-button" onClick={onSave}>
          저장
        </button>
      </div>
    </section>
  );
}

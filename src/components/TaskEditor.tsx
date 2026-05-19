import type { AutomationTask, BrowserRunTarget } from "../types";
import { LoginCheckPanel } from "./LoginCheckPanel";
import { ScheduleEditor } from "./ScheduleEditor";
import { StepEditor } from "./StepEditor";
import type { LoginCheckResult, ManagedBrowserProfileTarget } from "../types";

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
            <option value="managedProfile">전용 자동화 브라우저</option>
            <option value="existingTab">기존에 열려 있는 브라우저 탭</option>
          </select>
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

import type { ExecutionLog } from "../types";

const reasonCopy: Record<string, string> = {
  elementNotFound: "버튼을 찾지 못했습니다",
  loginCheckFailed: "로그인이 필요합니다",
  browserNotFound: "브라우저를 찾지 못했습니다",
  matchingTabNotFound: "대상 탭을 찾지 못했습니다",
};

type Props = {
  logs: ExecutionLog[];
  onClearLogs: () => void;
};

export function ExecutionLogs({ logs, onClearLogs }: Props) {
  return (
    <section className="logs-panel">
      <div className="section-heading">
        <h2>실행 로그</h2>
        {logs.length > 0 && (
          <button type="button" className="secondary-button" onClick={onClearLogs}>
            로그 전체 삭제
          </button>
        )}
      </div>
      {logs.length === 0 ? (
        <p className="hint">아직 실행 로그가 없습니다.</p>
      ) : (
        <ul className="log-list">
          {logs.map((log) => (
            <li key={log.id}>
              <div>
                <strong>{log.taskName}</strong>
                <span>{log.status}</span>
              </div>
              <p className="log-time">시작: {formatTimestamp(log.startedAt)}</p>
              {log.finishedAt && <p className="log-time">완료: {formatTimestamp(log.finishedAt)}</p>}
              {log.failureReason && <p>실패 사유: {reasonCopy[log.failureReason] ?? log.failureReason}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}년 ${part("month")}월 ${part("day")}일 ${part("hour")}시 ${part("minute")}분 ${part("second")}초`;
}

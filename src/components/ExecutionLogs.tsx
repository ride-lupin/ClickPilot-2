import type { ExecutionLog } from "../types";

const reasonCopy: Record<string, string> = {
  elementNotFound: "버튼을 찾지 못했습니다",
  loginCheckFailed: "로그인이 필요합니다",
  browserNotFound: "브라우저를 찾지 못했습니다",
  matchingTabNotFound: "대상 탭을 찾지 못했습니다",
};

type Props = {
  logs: ExecutionLog[];
};

export function ExecutionLogs({ logs }: Props) {
  return (
    <section className="logs-panel">
      <h2>실행 로그</h2>
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
              {log.screenshotPath && (
                <button type="button" className="link-button" onClick={() => openScreenshot(log.screenshotPath!, log.taskName)}>
                  스크린샷 보기
                </button>
              )}
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

function openScreenshot(source: string, taskName: string) {
  const viewer = window.open("", "_blank");
  if (!viewer) {
    const link = document.createElement("a");
    link.href = source;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.click();
    return;
  }

  viewer.document.write(`<!doctype html>
    <html lang="ko">
      <head>
        <title>${escapeHtml(taskName)} 스크린샷</title>
        <style>
          body { margin: 0; background: #111; display: grid; min-height: 100vh; place-items: center; }
          img { max-width: 100vw; max-height: 100vh; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${escapeAttribute(source)}" alt="${escapeAttribute(taskName)} 실행 스크린샷" />
      </body>
    </html>`);
  viewer.document.close();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => htmlEscapes[character]);
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

const htmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

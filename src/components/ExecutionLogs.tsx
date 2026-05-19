import type { ExecutionLog } from "../types";

const reasonCopy: Record<string, string> = {
  elementNotFound: "버튼을 찾지 못했습니다",
  loginCheckFailed: "로그인이 필요합니다",
  browserNotFound: "브라우저를 찾지 못했습니다",
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
              {log.failureReason && <p>실패 사유: {reasonCopy[log.failureReason] ?? log.failureReason}</p>}
              {log.screenshotPath && <a href={log.screenshotPath}>스크린샷 보기</a>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

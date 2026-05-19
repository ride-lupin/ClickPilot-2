import type { Schedule } from "../types";

type Props = {
  value: Schedule;
  onChange: (schedule: Schedule) => void;
};

const weekdays = ["월", "화", "수", "목", "금"];

export function ScheduleEditor({ value, onChange }: Props) {
  return (
    <fieldset className="form-section">
      <legend>스케줄</legend>
      <label>
        스케줄 유형
        <select
          value={value.type}
          onChange={(event) => {
            const type = event.target.value;
            if (type === "oneShot") onChange({ type, runAt: new Date().toISOString().slice(0, 19) });
            if (type === "daily") onChange({ type, timeOfDay: "09:00:00" });
            if (type === "weekly") onChange({ type, days: ["월"], timeOfDay: "09:00:00" });
            if (type === "repeatInterval") onChange({ type, intervalMs: 60000 });
          }}
        >
          <option value="oneShot">한 번</option>
          <option value="daily">매일</option>
          <option value="weekly">매주</option>
          <option value="repeatInterval">반복</option>
        </select>
      </label>

      {value.type === "oneShot" && (
        <label>
          실행 일시
          <input type="datetime-local" step={1} value={value.runAt} onChange={(event) => onChange({ ...value, runAt: event.target.value })} />
        </label>
      )}

      {(value.type === "daily" || value.type === "weekly") && (
        <label>
          실행 시간
          <input
            type="time"
            step={1}
            value={value.timeOfDay}
            onChange={(event) => onChange({ ...value, timeOfDay: event.target.value })}
          />
        </label>
      )}

      {value.type === "weekly" && (
        <div className="weekday-row" aria-label="요일">
          {weekdays.map((day) => (
            <label key={day} className="inline-check">
              <input
                type="checkbox"
                checked={value.days.includes(day)}
                onChange={(event) => {
                  const days = event.target.checked ? [...value.days, day] : value.days.filter((candidate) => candidate !== day);
                  onChange({ ...value, days });
                }}
              />
              {day}
            </label>
          ))}
        </div>
      )}

      {value.type === "repeatInterval" && (
        <div className="field-grid">
          <label>
            반복 간격(ms)
            <input
              type="number"
              min={1000}
              value={value.intervalMs}
              onChange={(event) => onChange({ ...value, intervalMs: Number(event.target.value) })}
            />
          </label>
          <label>
            최대 실행 횟수
            <input
              type="number"
              min={1}
              value={value.maxRuns ?? ""}
              onChange={(event) => onChange({ ...value, maxRuns: event.target.value ? Number(event.target.value) : undefined })}
            />
          </label>
          <label>
            종료 일시
            <input type="datetime-local" value={value.endAt ?? ""} onChange={(event) => onChange({ ...value, endAt: event.target.value })} />
          </label>
        </div>
      )}

      <p className="hint">앱이 실행 중일 때 예약 실행됩니다</p>
    </fieldset>
  );
}

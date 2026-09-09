import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPut, apiDelete } from "../api";

type ScheduleConfig = {
  id: number;
  target_id: number;
  messages_per_day: number;
  window_start: string;
  window_end: string;
  min_gap_minutes: number;
};

export default function Schedules() {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [targetId, setTargetId] = useState("");
  const [messagesPerDay, setMessagesPerDay] = useState("3");
  const [windowStart, setWindowStart] = useState("08:00");
  const [windowEnd, setWindowEnd] = useState("22:00");
  const [minGap, setMinGap] = useState("30");

  async function refresh() {
    setSchedules(await apiGet<ScheduleConfig[]>("/api/schedules"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const id = Number(targetId);
    await apiPut(`/api/schedules/${id}`, {
      target_id: id,
      messages_per_day: Number(messagesPerDay),
      window_start: windowStart,
      window_end: windowEnd,
      min_gap_minutes: Number(minGap),
    });
    await refresh();
  }

  async function handleDelete(target_id: number) {
    await apiDelete(`/api/schedules/${target_id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Schedules</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="Target ID" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <input placeholder="Messages/day" value={messagesPerDay} onChange={(e) => setMessagesPerDay(e.target.value)} />
        <input placeholder="Window start (HH:MM)" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
        <input placeholder="Window end (HH:MM)" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
        <input placeholder="Min gap (minutes)" value={minGap} onChange={(e) => setMinGap(e.target.value)} />
        <button type="submit">Save schedule</button>
      </form>
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            target {s.target_id}: {s.messages_per_day}/day, {s.window_start}-{s.window_end}, gap {s.min_gap_minutes}m
            <button onClick={() => handleDelete(s.target_id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

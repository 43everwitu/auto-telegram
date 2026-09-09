import { useEffect, useState } from "react";
import { apiGet } from "../api";

type SendLog = {
  id: number;
  target_id: number;
  template_id: number | null;
  sent_at: string;
  status: string;
  error_message: string | null;
};

type Stats = Record<string, Record<string, number>>;

export default function Logs() {
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    apiGet<SendLog[]>("/api/logs").then(setLogs);
    apiGet<Stats>("/api/logs/stats").then(setStats);
  }, []);

  return (
    <div>
      <h1>Logs & Stats</h1>
      <table>
        <thead>
          <tr>
            <th>Target</th>
            <th>Sent at</th>
            <th>Status</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.target_id}</td>
              <td>{l.sent_at}</td>
              <td>{l.status}</td>
              <td>{l.error_message ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Stats by target</h2>
      <ul>
        {Object.entries(stats).map(([targetId, counts]) => (
          <li key={targetId}>
            target {targetId}: {Object.entries(counts).map(([s, c]) => `${s}=${c}`).join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

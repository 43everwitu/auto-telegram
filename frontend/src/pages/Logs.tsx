import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { useI18n } from "../i18n";

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
  const { t } = useI18n();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    apiGet<SendLog[]>("/api/logs").then(setLogs);
    apiGet<Stats>("/api/logs/stats").then(setStats);
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>{t("logs.title")}</h1>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>{t("logs.target")}</th>
              <th>{t("logs.sentAt")}</th>
              <th>{t("logs.status")}</th>
              <th>{t("logs.error")}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>#{l.target_id}</td>
                <td>{l.sent_at}</td>
                <td>
                  <span className={`badge ${l.status === "success" ? "badge-accent" : "badge-muted"}`}>
                    {l.status}
                  </span>
                </td>
                <td>{l.error_message ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>{t("logs.statsTitle")}</h2>
        <ul className="list">
          {Object.entries(stats).map(([targetId, counts]) => (
            <li key={targetId} className="list-row">
              <span className="list-row-main">
                {t("logs.statsRow", {
                  id: targetId,
                  stats: Object.entries(counts).map(([s, c]) => `${s}=${c}`).join(", "),
                })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

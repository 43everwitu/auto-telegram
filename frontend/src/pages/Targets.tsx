import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Target = {
  id: number;
  account_id: number;
  telegram_chat_id: string;
  type: string;
  title: string;
  active: boolean;
};

export default function Targets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [accountId, setAccountId] = useState("");
  const [chatId, setChatId] = useState("");
  const [type, setType] = useState("channel");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setTargets(await apiGet<Target[]>("/api/targets"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/targets", {
        account_id: Number(accountId), telegram_chat_id: chatId, type, title,
      });
      setChatId("");
      setTitle("");
      setError(null);
      await refresh();
    } catch {
      setError("Failed to add target");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/targets/${id}`);
      setError(null);
      await refresh();
    } catch {
      setError("Failed to delete target");
    }
  }

  return (
    <div>
      <h1>Targets</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSubmit}>
        <input placeholder="Account ID" value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        <input placeholder="Chat ID" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="channel">channel</option>
          <option value="group">group</option>
        </select>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button type="submit">Add target</button>
      </form>
      <ul>
        {targets.map((t) => (
          <li key={t.id}>
            {t.title} ({t.type}) — {t.active ? "active" : "inactive"}
            <button onClick={() => handleDelete(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

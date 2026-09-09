import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Account = {
  id: number;
  phone: string;
  telegram_premium: boolean;
  status: string;
};

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sessionString, setSessionString] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setAccounts(await apiGet<Account[]>("/api/accounts"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSessionStringSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await apiPost("/api/accounts/session-string", { session_string: sessionString });
      setSessionString("");
      setError(null);
      await refresh();
    } catch {
      setError("Failed to add account");
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiDelete(`/api/accounts/${id}`);
      setError(null);
      await refresh();
    } catch {
      setError("Failed to delete account");
    }
  }

  return (
    <div>
      <h1>Accounts</h1>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={handleSessionStringSubmit}>
        <input
          placeholder="Session string"
          value={sessionString}
          onChange={(e) => setSessionString(e.target.value)}
        />
        <button type="submit">Add via session string</button>
      </form>
      <ul>
        {accounts.map((a) => (
          <li key={a.id}>
            {a.phone} — {a.status} {a.telegram_premium ? "(Premium)" : ""}
            <button onClick={() => handleDelete(a.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

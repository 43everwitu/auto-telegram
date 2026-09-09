import { useEffect, useState, FormEvent } from "react";
import { apiGet, apiPost, apiDelete } from "../api";

type Template = {
  id: number;
  body: string;
  is_override: boolean;
  target_id: number | null;
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState("");

  async function refresh() {
    setTemplates(await apiGet<Template[]>("/api/templates"));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedTargetId = targetId ? Number(targetId) : null;
    await apiPost("/api/templates", {
      body, is_override: parsedTargetId !== null, target_id: parsedTargetId,
    });
    setBody("");
    setTargetId("");
    await refresh();
  }

  async function handleDelete(id: number) {
    await apiDelete(`/api/templates/${id}`);
    await refresh();
  }

  return (
    <div>
      <h1>Templates</h1>
      <form onSubmit={handleSubmit}>
        <textarea placeholder="Message body (HTML)" value={body} onChange={(e) => setBody(e.target.value)} />
        <input
          placeholder="Target ID (leave empty = shared)"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        />
        <button type="submit">Add template</button>
      </form>
      <ul>
        {templates.map((t) => (
          <li key={t.id}>
            {t.body} {t.target_id !== null ? `(override for target ${t.target_id})` : "(shared)"}
            <button onClick={() => handleDelete(t.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

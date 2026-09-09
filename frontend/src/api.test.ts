import { describe, it, expect, vi, beforeEach } from "vitest";
import { login, apiGet } from "./api";

describe("api client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("login stores the access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "tok-123" }),
      })
    );
    const token = await login("admin", "pw");
    expect(token).toBe("tok-123");
    expect(localStorage.getItem("access_token")).toBe("tok-123");
  });

  it("apiGet throws on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(apiGet("/api/targets")).rejects.toThrow();
  });
});

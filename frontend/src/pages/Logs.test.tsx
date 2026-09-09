import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Logs from "./Logs";
import * as api from "../api";

describe("Logs page", () => {
  it("renders send logs fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockImplementation(async (path: string) => {
      if (path === "/api/logs") {
        return [
          {
            id: 1, target_id: 1, template_id: 1,
            sent_at: "2026-09-10T08:00:00Z", status: "success", error_message: null,
          },
        ] as any;
      }
      return { "1": { success: 1 } } as any;
    });
    render(<Logs />);
    await waitFor(() => {
      expect(screen.getAllByText(/success/)[0]).toBeInTheDocument();
    });
  });
});

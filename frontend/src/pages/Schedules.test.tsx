import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Schedules from "./Schedules";
import * as api from "../api";

describe("Schedules page", () => {
  it("renders schedule configs fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, target_id: 1, messages_per_day: 3, window_start: "08:00", window_end: "22:00", min_gap_minutes: 30 },
    ]);
    render(<Schedules />);
    await waitFor(() => {
      expect(screen.getByText(/target 1/)).toBeInTheDocument();
    });
  });
});

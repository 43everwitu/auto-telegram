import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Accounts from "./Accounts";
import * as api from "../api";

describe("Accounts page", () => {
  it("renders accounts fetched from the API", async () => {
    vi.spyOn(api, "apiGet").mockResolvedValue([
      { id: 1, phone: "123456", telegram_premium: true, status: "active" },
    ]);
    render(<Accounts />);
    await waitFor(() => {
      expect(screen.getByText(/123456/)).toBeInTheDocument();
    });
  });
});

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import MetaConnectWizard from "./MetaConnectWizard";

jest.mock("axios");

describe("MetaConnectWizard Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    axios.get.mockResolvedValue({ data: { success: true, profile: { billing_mode: "direct_meta" } } });
    axios.put.mockResolvedValue({ data: { success: true } });
  });

  test("renders step 1 with billing architecture models", () => {
    render(<MetaConnectWizard onComplete={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText("Step 1: Choose Your WhatsApp Billing Architecture")).toBeTruthy();
    expect(screen.getByText("Model A: Direct Meta Billing")).toBeTruthy();
    expect(screen.getByText("Model B: Provider Credit Line")).toBeTruthy();
  });

  test("can step through wizard to step 11 go-live", async () => {
    const handleComplete = jest.fn();
    render(<MetaConnectWizard onComplete={handleComplete} onCancel={jest.fn()} />);

    // Click Continue 10 times to navigate through all 11 steps
    for (let i = 1; i <= 10; i++) {
      const continueBtn = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(continueBtn);
    }

    // Step 11 must now be visible
    expect(screen.getByText("Step 11: Go-Live Activation & Limits Overview")).toBeTruthy();
    const completeBtn = screen.getByRole("button", { name: /complete & activate/i });
    expect(completeBtn).toBeTruthy();

    fireEvent.click(completeBtn);
    await waitFor(() => expect(handleComplete).toHaveBeenCalledTimes(1));
    expect(handleComplete.mock.calls[0][0].billingMode).toBe("direct_meta");
  });

  test("allows switching billing mode to provider managed in step 1", () => {
    render(<MetaConnectWizard onComplete={jest.fn()} onCancel={jest.fn()} />);

    const modelB = screen.getByText("Model B: Provider Credit Line");
    fireEvent.click(modelB);

    // Navigate to step 11
    for (let i = 1; i <= 10; i++) {
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    }

    expect(screen.getByText("Provider Managed (Model B)")).toBeTruthy();
  });
});

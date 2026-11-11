import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import ChatCrmInterconnectPanel from "./ChatCrmInterconnectPanel";
import ExternalWebhookModal from "./ExternalWebhookModal";

jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test("ChatCrmInterconnectPanel renders 10-system CRM records, creates tickets, resolves status and toggles bot takeover", async () => {
  const onRefreshCrm = jest.fn();
  const onToggleBotPause = jest.fn();
  axios.post.mockResolvedValue({ data: { success: true, suggestedMessage: "Ticket TKT-1 created." } });

  render(
    <ChatCrmInterconnectPanel
      API="http://localhost:5000"
      selectedChat={{ id: "919876543210@c.us", name: "Kiran", phoneNumber: "919876543210", conversationId: 42 }}
      crmDetails={{
        tickets: [{ id: 1, ticket_no: "TKT-100", subject: "Billing help", status: "open" }],
        appointments: [{ id: 2, service_name: "Demo", slot_date: "2026-12-15", slot_time: "11:00", status: "held" }],
        orders: [{ id: 3, order_no: "ORD-50", total_amount: 1500, fulfillment_status: "confirmed" }],
        approvals: [],
      }}
      botPaused={true}
      onRefreshCrm={onRefreshCrm}
      onToggleBotPause={onToggleBotPause}
    />
  );

  expect(screen.getByText(/Human Takeover Active/i)).toBeTruthy();
  expect(screen.getByText(/TKT-100/)).toBeTruthy();
  expect(screen.getByText(/ORD-50/)).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Resume Bot" }));
  expect(onToggleBotPause).toHaveBeenCalledWith(false);

  fireEvent.click(screen.getByRole("button", { name: "+ Ticket" }));
  fireEvent.change(screen.getByPlaceholderText("Ticket subject *"), { target: { value: "Callback requested" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Record" }));

  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:5000/api/v2/inbox/conversations/42/crm-action",
      expect.objectContaining({
        action: "create_ticket",
        payload: expect.objectContaining({ subject: "Callback requested" }),
      }),
      expect.any(Object)
    )
  );
  expect(onRefreshCrm).toHaveBeenCalledWith("919876543210@c.us");
});

test("ExternalWebhookModal loads config, saves tenant URL and sends test ping", async () => {
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/webhook")) {
      return { data: { success: true, webhook: { configured: true, webhook_url: "https://erp.example.test/hook", has_secret: true, is_active: true, subscribed_events: [] } } };
    }
    return { data: { success: true, deliveries: [{ id: 1, event: "message.received", url: "https://erp.example.test/hook", status: "delivered" }] } };
  });
  axios.post.mockResolvedValue({ data: { success: true, webhook: { has_secret: true } } });

  render(
    <ExternalWebhookModal
      open={true}
      onClose={jest.fn()}
      apiBase="http://localhost:5000"
      authHeaders={{ Authorization: "Bearer tok" }}
    />
  );

  await screen.findByDisplayValue("https://erp.example.test/hook");
  expect(screen.getAllByText("message.received").length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText("delivered")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Save Webhook" }));
  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:5000/api/crm/webhook/configure",
      expect.objectContaining({ webhookUrl: "https://erp.example.test/hook" }),
      expect.any(Object)
    )
  );

  fireEvent.click(screen.getByRole("button", { name: "Send Test Ping" }));
  await waitFor(() =>
    expect(axios.post).toHaveBeenCalledWith(
      "http://localhost:5000/api/crm/webhook/test",
      expect.any(Object),
      expect.any(Object)
    )
  );
});


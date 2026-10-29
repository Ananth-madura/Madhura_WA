import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import WhatsAppAutomations from "./whatsappAutomations";
jest.mock("axios");
jest.mock("../context/EnterpriseContext",()=>({useEnterprise:()=>({activeTenant:{id:1}})}));
jest.mock("react-router-dom", () => ({ useLocation: jest.fn(), useNavigate: jest.fn(), useSearchParams: () => [new URLSearchParams()] }));
jest.mock("../components/WAWorkspaceGuide", () => () => null);
jest.mock("../components/WhatsAppInteractiveReminders", () => () => null);
jest.mock("../components/WAVariablePicker", () => ({ __esModule: true, default: () => null, evaluateMessagePlaceholders: text => text }));

const navigate = jest.fn();
beforeEach(() => {
  jest.resetAllMocks();
  useLocation.mockReturnValue({ pathname: "/whatsapp/automations/create", state: null });
  useNavigate.mockReturnValue(navigate);
  axios.get.mockImplementation(async url => ({ data: url.endsWith("/references") ? {senders:[{id:1,display_phone:"+919111111111",status:"connected"}],groups:[],flows:[],templates:[
    { id: 1, name: "approved_reminder", meta_status: "APPROVED", body: "Hello {name}" },
    { id: 2, name: "draft_reminder", meta_status: "DRAFT", body: "Draft" },
  ]} : url.endsWith("/stats") ? {} : url.endsWith("/welcome-settings") ? null : [] }));
  axios.post.mockResolvedValue({ data: { id: 22 } });
  axios.put.mockResolvedValue({ data: { success: true } });
});

const open = () => render(<WhatsAppAutomations />);

test("the full-page editor evaluates edited sample events without sending requests", async () => {
  open();
  await screen.findByRole("heading", { name: "Create WhatsApp Automation" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add condition" }));
  fireEvent.change(screen.getByLabelText("Condition 1 field"), { target: { value: "amount" } });
  fireEvent.change(screen.getByLabelText("Condition 1 comparison"), { target: { value: "gte" } });
  fireEvent.change(screen.getByLabelText("Condition 1 value"), { target: { value: "2000" } });
  expect(screen.getByText("Sample is excluded by the conditions")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Event data (JSON)"), { target: { value: '{"name":"Priya","amount":2500}' } });
  expect(screen.getByText("Sample matches the conditions")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Event data (JSON)"), { target: { value: '{broken' } });
  expect(screen.getByRole("alert")).toHaveTextContent("valid JSON event");
  expect(axios.post).not.toHaveBeenCalled();
});

test("starters, template follow-ups, replies and paused activation are saved together", async () => {
  open();
  await waitFor(() => expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/references"), expect.anything()));
  fireEvent.click(screen.getByRole("button", { name: "Apply starter" }));
  expect(screen.getByLabelText("Rule Name *")).toHaveValue("Invoice Created");
  fireEvent.click(screen.getByLabelText("Enable a follow-up message"));
  fireEvent.change(screen.getByLabelText("Follow-up format"), { target: { value: "media" } });
  expect(screen.getByLabelText("Attachment HTTPS URL")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Follow-up format"), { target: { value: "template" } });
  expect(await screen.findByRole("option", { name: "approved_reminder" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "draft_reminder" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Follow-up template"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Add reply option" }));
  fireEvent.change(screen.getByLabelText("Reply 1 label"), { target: { value: "Invoice help" } });
  fireEvent.change(screen.getByLabelText("Response message"), { target: { value: "Our accounts team can help." } });
  fireEvent.click(screen.getByLabelText(/Enable when saved/));
  expect(screen.getByText("Ready to save")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Create rule" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/whatsapp/automations", { replace: true }));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/wa/automations"), expect.objectContaining({ trigger_type: "invoice_created", followup_template_id: "1", followup_media_url: null, is_active: 0 }), expect.anything());
  expect(axios.post).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({sender_id:1,options:[{label:"Invoice help",reply_text:"Our accounts team can help."}]}),expect.anything());
  expect(axios.put).not.toHaveBeenCalled();
});

test("changing a trigger preserves a custom message and cancel returns to the list", async () => {
  open();
  await screen.findByRole("heading", { name: "Create WhatsApp Automation" });
  fireEvent.change(screen.getByLabelText("Main message text"), { target: { value: "My own message {name}" } });
  fireEvent.change(screen.getByLabelText("Trigger Event *"), { target: { value: "new_lead" } });
  expect(screen.getByLabelText("Main message text")).toHaveValue("My own message {name}");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(navigate).toHaveBeenCalledWith("/whatsapp/automations", { replace: true });
  expect(axios.post).not.toHaveBeenCalled();
});

test("a linked edit page loads saved replies and submits its revision atomically", async () => {
  useLocation.mockReturnValue({pathname:"/whatsapp/automations/22/edit",state:null});
  const previous=axios.get.getMockImplementation();
  axios.get.mockImplementation(async(url,...args)=>url.endsWith("/automations/22")?{data:{id:22,revision:7,sender_id:1,name:"Saved rule",trigger_type:"new_lead",message_text:"Hello {name}",is_active:0,options:[{label:"Details",reply_text:"Tell us more"}]}}:previous(url,...args));
  open();
  expect(await screen.findByDisplayValue("Saved rule")).toBeInTheDocument();
  expect(screen.getByRole("heading",{name:"Edit WhatsApp Automation"})).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Rule Name *"),{target:{value:"Updated rule"}});
  fireEvent.click(screen.getByRole("button",{name:"Save rule"}));
  await waitFor(()=>expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/automations/22"),expect.objectContaining({revision:7,name:"Updated rule",sender_id:1,options:[{label:"Details",reply_text:"Tell us more"}]}),expect.anything()));
  expect(axios.put).toHaveBeenCalledTimes(1);
  expect(axios.post).not.toHaveBeenCalled();
});

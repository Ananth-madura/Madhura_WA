import { render, screen } from "@testing-library/react";
import axios from "axios";
import socket from "../socket/socket";
import WhatsAppNav from "./WhatsAppNav";
import { useAuth } from "../auth/AuthContext";

const mockNavigate = jest.fn();
let mockPathname = "/whatsapp/team-inbox";
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));
jest.mock("axios", () => ({ get: jest.fn() }));
jest.mock("../auth/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../socket/socket", () => ({ on: jest.fn(), off: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = "/whatsapp/team-inbox";
  useAuth.mockReturnValue({ user: { id: 2, role: "employee", name: "Priya" } });
});

const tabLabels = () => [...document.querySelectorAll(".wa-nav-tab-btn")].map(button => button.textContent.trim());

test("assigned scope shows only the three employee tabs", () => {
  render(<WhatsAppNav scope="assigned" />);
  expect(tabLabels()).toEqual(["Team Inbox", "My workspace", "My campaigns"]);
  for (const adminTab of ["Live Chats", "Contacts", "Enquiries", "Templates", "Analytics", "Branches", "Employees", "Accounts"]) {
    expect(screen.queryByText(adminTab)).toBeNull();
  }
});

test("assigned scope never polls administration endpoints", () => {
  render(<WhatsAppNav scope="assigned" />);
  expect(axios.get).not.toHaveBeenCalled();
  expect(socket.on).not.toHaveBeenCalled();
});

test("workspace tab is exact so campaigns does not keep it active", () => {
  mockPathname = "/whatsapp/workspace/campaigns";
  render(<WhatsAppNav scope="assigned" />);
  const active = [...document.querySelectorAll(".wa-nav-tab-btn.is-active")].map(button => button.textContent.trim());
  expect(active).toEqual(["My campaigns"]);
});

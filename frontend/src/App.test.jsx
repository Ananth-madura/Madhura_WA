import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import App from "./App";
import { useAuth } from "./auth/AuthContext";

jest.mock("react-router-dom", () => {
  global.TextEncoder = require("util").TextEncoder;
  global.TextDecoder = require("util").TextDecoder;
  return jest.requireActual("react-router");
});

jest.mock("./auth/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn(),
}));
jest.mock("./context/EnterpriseContext", () => ({ EnterpriseProvider: ({ children }) => children }));
jest.mock("./context/BranchContext", () => ({ BranchProvider: ({ children }) => children }));
jest.mock("./auth/login", () => () => <h1>Application login</h1>);
jest.mock("./layout/WALayout", () => {
  const { Outlet } = require("react-router-dom");
  return { __esModule: true, default: () => <Outlet /> };
});
jest.mock("./pages/whatsapp", () => () => <h1>Workspace inbox</h1>);
jest.mock("agentation", () => ({ Agentation: () => null }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  useAuth.mockReturnValue({ user: null, initializing: false });
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

test("opening the app root while signed out stays on the app and opens login", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Application login" });
  expect(window.location.pathname).toBe("/login");
});

test("opening the app root while signed in opens the workspace", async () => {
  useAuth.mockReturnValue({ user: { id: 1 }, initializing: false });
  render(<App />);
  await screen.findByRole("heading", { name: "Workspace inbox" });
  expect(window.location.pathname).toBe("/whatsapp");
});

test("the app entry preserves login parameters instead of handing them to marketing", async () => {
  window.history.replaceState({}, "", "/?tab=demo&returnUrl=%2Fwhatsapp%2Fcontacts#signin");
  render(<App />);
  await screen.findByRole("heading", { name: "Application login" });
  expect(window.location.pathname).toBe("/login");
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("demo");
  expect(new URLSearchParams(window.location.search).get("returnUrl")).toBe("/whatsapp/contacts");
  expect(window.location.hash).toBe("#signin");
});

test("a signed-out workspace deep link keeps its destination for login", async () => {
  window.history.replaceState({}, "", "/whatsapp/contacts?filter=opted_in#list");
  render(<App />);
  await screen.findByRole("heading", { name: "Application login" });
  expect(new URLSearchParams(window.location.search).get("returnUrl")).toBe("/whatsapp/contacts?filter=opted_in#list");
});

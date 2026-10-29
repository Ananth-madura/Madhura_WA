import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Workspace } from "../../../frontend/src/pages/accounts/AccountWorkspace.jsx";
const context = { activeTenant: { id: 7, name: "Fixture business" }, branches: [{ id: 1, name: "North branch", status: "active" }, { id: 2, name: "South branch", status: "active" }], isOwnerOrAdmin: true, getHeaders: () => ({}) };
createRoot(document.getElementById("root")).render(<BrowserRouter><Workspace enterprise={context} /></BrowserRouter>);

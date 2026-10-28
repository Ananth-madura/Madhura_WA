import { createRoot } from "react-dom/client";
import { AuthProvider } from "../src/auth/AuthContext";
import { EnterpriseProvider } from "../src/context/EnterpriseContext";
import TeamChat from "../src/components/TeamChat";
import "../src/pages/whatsapp-workspace.css";
import * as cache from "../src/utils/teamChatIndexedDB";

window.teamChatTestStorage = cache;

createRoot(document.getElementById("root")).render(<AuthProvider><EnterpriseProvider><TeamChat /></EnterpriseProvider></AuthProvider>);

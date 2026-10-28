import React from "react";
import TeamChat from "./TeamChat";

/**
 * SharedTeamInbox — Dedicated Internal Employee Team Messaging Platform
 *
 * Route: `/whatsapp/team-inbox`
 * Exclusively for internal employee-to-employee messaging (Individual 1:1 & Group Channels).
 * Strictly decoupled from customer conversations (no customer tabs, no customer chats).
 */
export default function SharedTeamInbox(props) {
  return <TeamChat {...props} />;
}

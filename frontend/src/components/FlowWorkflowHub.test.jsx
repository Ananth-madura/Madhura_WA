import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import FlowStarterPicker from "./FlowStarterPicker";
import FlowSwitchOptions from "./FlowSwitchOptions";
import FlowRunEvents from "./FlowRunEvents";
import FlowBusinessActionOptions from "./FlowBusinessActionOptions";
import WorkflowSystemHubModal from "./WorkflowSystemHubModal";
jest.mock("axios");

beforeEach(() => jest.resetAllMocks());

test("business users can filter industry starters and load an independent draft", async () => {
  const booking={key:"appointments.booking_create",name:"New booking",category:"Appointments",description:"Collect and confirm booking details",nodes:[{node_key:"start",node_type:"start",config:{}}]};
  axios.get.mockResolvedValue({data:[booking,{key:"hr.leave",name:"Leave request",category:"Employee self-service",description:"Leave approval",nodes:[]}]});
  const choose=jest.fn();
  render(<FlowStarterPicker onChoose={choose}/>);
  await screen.findByRole("option",{name:"New booking"});
  fireEvent.change(screen.getByLabelText("Industry or system"),{target:{value:"Appointments"}});
  expect(screen.queryByRole("option",{name:"Leave request"})).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/Starter/),{target:{value:booking.key}});
  fireEvent.click(screen.getByRole("button",{name:"Use this starter"}));
  expect(choose).toHaveBeenCalledWith(booking);
  expect(choose.mock.calls[0][0]).not.toBe(booking);
});

test("adding a switch route preserves existing connections",()=>{
  const onChange=jest.fn();
  const first={label:"Repairs",operator:"equals",value:"repair",next_node_key:"repair"};
  render(<FlowSwitchOptions config={{variable:"service",cases:[first],fallback_node_key:"other"}} onChange={onChange}/>);
  fireEvent.click(screen.getByRole("button",{name:"Add route"}));
  expect(onChange.mock.calls[0][0].cases[0]).toEqual(first);
  expect(onChange.mock.calls[0][0].cases).toHaveLength(2);
});

test("execution audit surfaces access failures and can retry",async()=>{
  axios.get.mockRejectedValue({response:{data:{error:"Run not found"}}});
  render(<FlowRunEvents flowId={5} runId={9}/>);
  fireEvent.click(screen.getByText("View execution"));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent("Run not found");
  axios.get.mockResolvedValue({data:[{id:1,node_key:"booking",event_type:"action_succeeded",created_at:"2026-10-29T09:00:00Z"}]});
  fireEvent.click(screen.getByRole("button",{name:"Retry events"}));
  expect(await screen.findByText(/action succeeded/)).toBeInTheDocument();
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/5/runs/9/events"));
});

test("business action supports switching between built-in CRM and external API with presets", () => {
  const onChange = jest.fn();
  render(<FlowBusinessActionOptions config={{ connection: "business", operation: "appointments.booking_create", inputs: {}, outputs: {} }} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /Built-in CRM/i }));
  expect(onChange).toHaveBeenCalledWith({ connection: "builtin" });
  fireEvent.change(screen.getByLabelText(/10-System Operation Preset/i), { target: { value: "support.ticket_create" } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ operation: "support.ticket_create" }));
});

test("10-system hub modal renders systems, toggles execution mode, and installs packs", async () => {
  axios.get.mockResolvedValue({
    data: {
      totalTemplates: 1,
      installedByKey: {},
      systems: [
        {
          id: "appointments",
          name: "Appointments",
          industries: "Clinics & salons",
          templates: [
            {
              key: "enterprise.appointments.01_new_booking",
              name: "01. New Appointment Booking",
              category: "Appointments",
              description: "Slot booking & staff assignment",
              isFlagship: true,
              trigger_config: { keywords: ["book"] },
              nodes: [{ node_key: "start", node_type: "contact_lookup" }],
            },
          ],
        },
      ],
    },
  });
  axios.post.mockResolvedValue({ data: { success: true, installedCount: 1, publishedCount: 0, skippedCount: 0, installed: [{ id: 88, name: "01. New Appointment Booking" }] } });
  const onInstalled = jest.fn();
  const onEditFlow = jest.fn();
  const onClose = jest.fn();

  render(<WorkflowSystemHubModal open onClose={onClose} onInstalled={onInstalled} onEditFlow={onEditFlow} />);
  await screen.findByText("01. New Appointment Booking");
  fireEvent.click(screen.getByRole("button", { name: /Use & Edit in Canvas/i }));
  await waitFor(() => expect(onEditFlow).toHaveBeenCalledWith(88));
  expect(onInstalled).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/hub/install"), expect.objectContaining({
    templateKeys: ["enterprise.appointments.01_new_booking"],
    connectionMode: "builtin",
  }));
});

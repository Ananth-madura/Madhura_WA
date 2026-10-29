import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import axios from "axios";
import FlowStarterPicker from "./FlowStarterPicker";
import FlowSwitchOptions from "./FlowSwitchOptions";
import FlowRunEvents from "./FlowRunEvents";
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

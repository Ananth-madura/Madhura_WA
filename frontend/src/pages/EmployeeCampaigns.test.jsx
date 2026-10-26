import {act} from "react";
import {render,screen,waitFor} from "@testing-library/react";
import EmployeeCampaigns from "./EmployeeCampaigns";
import api from "../config/axios";
import {useEnterprise} from "../context/EnterpriseContext";
jest.mock("../config/axios",()=>({get:jest.fn(),post:jest.fn()}));
jest.mock("../context/EnterpriseContext",()=>({useEnterprise:jest.fn()}));
jest.mock("../socket/socket",()=>({on:jest.fn(),off:jest.fn()}));
beforeEach(()=>jest.clearAllMocks());
test("campaign permission denial cannot expose recipients or launch controls",async()=>{
  useEnterprise.mockReturnValue({activeTenant:{id:1}});
  api.get.mockRejectedValue({response:{status:403,data:{message:"This module action is not permitted"}}});
  render(<EmployeeCampaigns/>);
  expect((await screen.findByRole("alert")).textContent).toContain("not permitted");
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.getByRole("button",{name:"Create draft campaign"}).disabled).toBe(true);
  expect(api.post).not.toHaveBeenCalled();
});
test("late campaign and recipient results cannot cross an organization switch",async()=>{
  let tenant=1,finishOld;
  useEnterprise.mockImplementation(()=>({activeTenant:{id:tenant}}));
  api.get.mockImplementation(url=>{
    if(url.endsWith("/campaigns")&&tenant===1)return new Promise(resolve=>{finishOld=resolve;});
    if(url.endsWith("/campaigns"))return Promise.resolve({data:{records:[{id:2,name:"Second organization campaign",status:"draft",visible_recipients:1}],canEdit:true}});
    return Promise.resolve({data:url.endsWith("/senders")?{senders:[]}:{records:[]}});
  });
  const view=render(<EmployeeCampaigns/>);
  await waitFor(()=>expect(finishOld).toBeDefined());
  tenant=2;view.rerender(<EmployeeCampaigns/>);
  expect(await screen.findByText(/Second organization campaign/)).not.toBeNull();
  await act(async()=>finishOld({data:{records:[{id:1,name:"First organization private campaign"}],canEdit:true}}));
  expect(screen.queryByText(/First organization private campaign/)).toBeNull();
});

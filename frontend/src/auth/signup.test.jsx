import React from "react";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import axios from "axios";
import Signup from "./signup";
const mockLogin=jest.fn(),mockNavigate=jest.fn();
jest.mock("axios",()=>({get:jest.fn(),post:jest.fn()}));
jest.mock("./AuthContext",()=>({useAuth:()=>({login:mockLogin})}));
jest.mock("./demoSession",()=>({startDirectDemoSession:jest.fn()}));
jest.mock("react-router-dom",()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>,useNavigate:()=>mockNavigate,useLocation:()=>({search:"?plan=growth"})}));
const catalog=[{id:"free",name:"Free",price_inr:0,max_senders:1,max_branches:1,max_seats:2,features:[]},{id:"growth",name:"Growth",price_inr:3999,max_senders:3,max_branches:3,max_seats:15,features:["Verified paid feature"]}];
beforeEach(()=>{jest.clearAllMocks();axios.get.mockResolvedValue({data:{success:true,plans:catalog}});});
function identity(){
  fireEvent.change(screen.getByLabelText(/Organization Legal Name/),{target:{value:"New workspace"}});
  fireEvent.change(screen.getByLabelText(/First Name/),{target:{value:"New owner"}});
  fireEvent.change(screen.getByLabelText(/Work Email Address/),{target:{value:"owner@fixture.test"}});
  fireEvent.change(screen.getByLabelText(/Create Master Password/),{target:{value:"password123"}});
  fireEvent.change(screen.getByLabelText(/Confirm Password/),{target:{value:"password123"}});
  fireEvent.click(screen.getByRole("button",{name:/Proceed to Branch/}));
}
test("paid signup preserves cookie sessions and continues to real billing",async()=>{
  const nextPath="/whatsapp/billing?onboarding=1&plan=growth";
  axios.post.mockResolvedValue({data:{cookieSession:true,user:{id:8,tenant_id:7,branch_id:9,plan:"free"},checkoutRequired:true,nextPath}});
  render(<Signup/>);identity();const submit=await screen.findByRole("button",{name:/Create account.*continue to payment/});
  await waitFor(()=>expect(submit.disabled).toBe(false));fireEvent.click(submit);
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith(nextPath,{replace:true}));
  expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({cookieSession:true,plan:"free",active_tenant_id:7}));
  expect(axios.post.mock.calls[0][1].plan).toBe("growth");expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.get.mock.calls[0][0]).toMatch(/\/api\/v2\/billing\/plans$/);
});
test("free signup enters the workspace without a payment request",async()=>{
  axios.post.mockResolvedValue({data:{cookieSession:true,user:{id:8,tenant_id:7,branch_id:9,plan:"free"},nextPath:"/whatsapp"}});
  render(<Signup/>);identity();fireEvent.click(await screen.findByRole("radio",{name:/Free/}));
  fireEvent.click(screen.getByRole("button",{name:"Create free workspace"}));await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith("/whatsapp",{replace:true}));expect(axios.post).toHaveBeenCalledTimes(1);
});
test("unavailable catalog blocks submission and allows retry",async()=>{
  axios.get.mockRejectedValue(new Error("offline"));render(<Signup/>);identity();await screen.findByText(/Plans could not load/);
  expect(screen.getByRole("button",{name:"Create free workspace"}).disabled).toBe(true);expect(axios.post).not.toHaveBeenCalled();
  axios.get.mockResolvedValue({data:{plans:catalog}});fireEvent.click(screen.getByRole("button",{name:"Retry plans"}));await screen.findByRole("radio",{name:/Growth/});
});

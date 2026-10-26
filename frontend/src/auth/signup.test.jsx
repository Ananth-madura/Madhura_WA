import React from "react";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import axios from "axios";
import Signup from "./signup";
import {confirmBrowserSession} from "./browserSession";
const mockLogin=jest.fn(),mockNavigate=jest.fn();
let mockSearch = "?plan=growth";
jest.mock("axios",()=>({get:jest.fn(),post:jest.fn()}));
jest.mock("./AuthContext",()=>({useAuth:()=>({login:mockLogin})}));
jest.mock("./demoSession",()=>({startDirectDemoSession:jest.fn()}));
jest.mock("./browserSession",()=>({confirmBrowserSession:jest.fn(async data=>data)}));
jest.mock("react-router-dom",()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>,useNavigate:()=>mockNavigate,useLocation:()=>({search:mockSearch})}));
const catalog=[{id:"free",name:"Free",price_inr:0,max_senders:1,max_branches:1,max_seats:2,features:[]},{id:"growth",name:"Growth",price_inr:3999,max_senders:3,max_branches:3,max_seats:15,features:["Verified paid feature"]}];
beforeEach(()=>{jest.clearAllMocks();mockSearch="?plan=growth";confirmBrowserSession.mockReset().mockImplementation(async data=>data);axios.get.mockImplementation(async url=>({data:url.endsWith("/health")?{ok:true,sharedInboxReady:true,dbEngine:"mysql"}:{success:true,plans:catalog}}));});
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
  axios.get.mockImplementation(async url=>({data:url.endsWith("/health")?{ok:true,sharedInboxReady:true,dbEngine:"mysql"}:{plans:catalog}}));fireEvent.click(screen.getByRole("button",{name:"Retry plans"}));await screen.findByRole("radio",{name:/Growth/});
});
test("SQLite can display plans while clearly pausing MySQL-only onboarding",async()=>{
  axios.get.mockImplementation(async url=>({data:url.endsWith("/health")?{ok:true,sharedInboxReady:true,dbEngine:"sqlite"}:{plans:catalog}}));
  render(<Signup/>);identity();await screen.findByRole("radio",{name:/Growth/});await screen.findByText(/New workspace signup and Razorpay settlement require MySQL/);
  expect(screen.getByRole("button",{name:/Create account.*continue to payment/}).disabled).toBe(true);expect(axios.post).not.toHaveBeenCalled();
});
test("blocked cookie sessions do not publish a logged-in profile or redirect",async()=>{
  axios.post.mockResolvedValue({data:{cookieSession:true,user:{id:8,tenant_id:7,plan:"free"},nextPath:"/whatsapp"}});
  confirmBrowserSession.mockRejectedValueOnce(Object.assign(new Error("Session could not be saved"),{friendlyMessage:"Session could not be saved"}));
  render(<Signup/>);identity();const submit=await screen.findByRole("button",{name:/Create account.*continue to payment/});await waitFor(()=>expect(submit.disabled).toBe(false));fireEvent.click(submit);
  await screen.findByText("Session could not be saved");expect(mockLogin).not.toHaveBeenCalled();expect(mockNavigate).not.toHaveBeenCalled();
});

test("an invited employee activates inside the organization and branch verified from the code", async () => {
  mockSearch = "?tab=access_code&code=WA-FIXTURE";
  const user = { id: 14, role: "employee", tenant_id: 7, branch_id: 9 };
  axios.post.mockImplementation(async url => ({ data: url.endsWith("verify-access-code")
    ? { valid: true, email: "staff@fixture.test", first_name: "Staff", role: "employee", tenant_name: "Inviting company", branch_name: "Regional office", requires_activation: true }
    : { cookieSession: true, user, nextPath: "/whatsapp" } }));
  render(<Signup />);
  await screen.findByText("Valid Access Code for Inviting company");
  fireEvent.change(screen.getByLabelText("Set Personal Password *"), { target: { value: "employee-password" } });
  fireEvent.change(screen.getByLabelText("Confirm Password *"), { target: { value: "employee-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Activate account & open workspace" }));
  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({ ...user, active_tenant_id: 7, active_branch_id: 9 })));
  expect(mockNavigate).toHaveBeenCalledWith("/whatsapp", { replace: true });
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/join-with-access-code$/), expect.objectContaining({ access_code: "WA-FIXTURE", email: "staff@fixture.test", password: "employee-password" }), expect.anything());
});

test("active employees sign in with their existing password without a password-reset form", async () => {
  mockSearch = "?tab=access_code&code=WA-ACTIVE";
  axios.post.mockImplementation(async url => ({ data: url.endsWith("verify-access-code")
    ? { valid: true, email: "staff@fixture.test", first_name: "Staff", role: "employee", tenant_name: "Inviting company", branch_name: "Regional office", requires_activation: false }
    : { cookieSession: true, user: { id: 14, role: "employee", tenant_id: 7, branch_id: 9 }, nextPath: "/whatsapp" } }));
  render(<Signup />);
  await screen.findByLabelText("Your Existing Password *");
  expect(screen.queryByLabelText("Confirm Password *")).toBeNull();
  fireEvent.change(screen.getByLabelText("Your Existing Password *"), { target: { value: "existing-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to your organization" }));
  await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  expect(mockLogin.mock.calls[0][0].role).toBe("employee");
});

test("invalid invitations explain the failure and cannot submit employee activation", async () => {
  mockSearch = "?tab=access_code&code=WA-REVOKED";
  axios.post.mockRejectedValue({ response: { status: 403, data: { message: "Your organization membership is not active." } } });
  render(<Signup />);
  await screen.findByText("Your organization membership is not active.");
  expect(screen.getByRole("button", { name: "Activate account & open workspace" }).disabled).toBe(true);
  expect(mockLogin).not.toHaveBeenCalled();
});

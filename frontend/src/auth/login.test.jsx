import React from "react";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import axios from "axios";
import Login from "./login";
import {confirmBrowserSession} from "./browserSession";
import { MARKETING } from "../config/index";
const mockLogin=jest.fn(),mockNavigate=jest.fn();
jest.mock("axios",()=>({post:jest.fn()}));
jest.mock("./AuthContext",()=>({useAuth:()=>({login:mockLogin})}));
jest.mock("./demoSession",()=>({startDirectDemoSession:jest.fn()}));
jest.mock("./browserSession",()=>({confirmBrowserSession:jest.fn(async data=>data)}));
jest.mock("react-router-dom",()=>({Link:({to,children,...props})=><a href={to} {...props}>{children}</a>,useNavigate:()=>mockNavigate,useLocation:()=>({search:""})}));
beforeEach(()=>{jest.clearAllMocks();confirmBrowserSession.mockReset().mockImplementation(async data=>data);});
function submit(){
  fireEvent.change(screen.getByLabelText(/Work Email or Employee ID/),{target:{value:"owner@fixture.test"}});
  fireEvent.change(screen.getByLabelText(/^Password/),{target:{value:"fixture-password"}});
  fireEvent.click(screen.getByRole("button",{name:"Sign In to Dashboard"}));
}
test("login enters the workspace after the cookie session is confirmed",async()=>{
  const data={cookieSession:true,user:{id:7,tenant_id:8,branch_id:9},nextPath:"/whatsapp"};axios.post.mockResolvedValue({data});
  render(<Login/>);submit();
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith("/whatsapp",{replace:true}));expect(confirmBrowserSession).toHaveBeenCalledWith(data);expect(mockLogin).toHaveBeenCalledWith(expect.objectContaining({cookieSession:true,tenant_id:8}));
});
test("a cookie failure remains on login with an actionable error",async()=>{
  axios.post.mockResolvedValue({data:{cookieSession:true,user:{id:7}}});confirmBrowserSession.mockRejectedValueOnce(Object.assign(new Error("Allow cookies and retry sign-in"),{friendlyMessage:"Allow cookies and retry sign-in"}));
  render(<Login/>);submit();await screen.findByText("Allow cookies and retry sign-in");expect(mockLogin).not.toHaveBeenCalled();expect(mockNavigate).not.toHaveBeenCalled();
});

test("back to home links to the marketing origin rather than the app login route", () => {
  render(<Login />);
  expect(screen.getByRole("link", { name: /Back to Home/ }).getAttribute("href")).toBe(MARKETING);
});

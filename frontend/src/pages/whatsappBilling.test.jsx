import React from "react";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import axios from "axios";
import WABilling from "./whatsappBilling";
import {openRazorpayCheckout} from "../utils/razorpayCheckout";
const mockNavigate=jest.fn();
jest.mock("axios",()=>({get:jest.fn(),post:jest.fn()}));
jest.mock("../context/EnterpriseContext",()=>({useEnterprise:()=>({activeTenant:{id:7},refreshEnterpriseContext:jest.fn()})}));
jest.mock("../utils/razorpayCheckout",()=>({openRazorpayCheckout:jest.fn()}));
jest.mock("react-router-dom",()=>({useLocation:()=>({search:""}),useNavigate:()=>mockNavigate}));
const plan={id:"starter",name:"Starter",price_inr:"1499.00",features:[]};
let canManage,pendingPlan;
beforeEach(()=>{
  jest.clearAllMocks();canManage=true;pendingPlan=null;
  axios.get.mockImplementation(async url=>({data:url.endsWith("/plans")?{success:true,plans:[plan]}:url.endsWith("/gateway")?{success:true,configured:true,checkoutEnabled:true,webhookConfigured:true,mode:"test",canManage}:url.endsWith("/orders")?{success:true,orders:[]}:{success:true,organization:{plan:"free",pending_plan_id:pendingPlan},wallets:{}}}));
});
test("billing opens real Checkout and submits provider proof with tenant scope",async()=>{
  const session={success:true,orderId:"order_server",amount:149900,keyId:"rzp_test_fixture",currency:"INR"};
  axios.post.mockResolvedValueOnce({data:session}).mockResolvedValueOnce({data:{success:true}});
  const proof={orderId:"order_server",paymentId:"pay_provider",signature:"actual-proof"};openRazorpayCheckout.mockResolvedValue(proof);
  render(<WABilling/>);fireEvent.click(await screen.findByRole("button",{name:"Pay with Razorpay"}));
  await waitFor(()=>expect(axios.post).toHaveBeenCalledTimes(2));
  expect(openRazorpayCheckout).toHaveBeenCalledWith(session);
  expect(axios.post.mock.calls[1][1]).toEqual({planId:"starter",...proof});
  expect(axios.post.mock.calls[1][2].headers["x-tenant-id"]).toBe(7);
  await screen.findByText(/Subscription updated/);
});
test("dismissed Checkout never confirms or changes a plan",async()=>{
  axios.post.mockResolvedValue({data:{success:true,orderId:"order_server",amount:149900}});openRazorpayCheckout.mockRejectedValue(new Error("Checkout closed"));
  render(<WABilling/>);fireEvent.click(await screen.findByRole("button",{name:"Pay with Razorpay"}));
  await screen.findByText("Checkout closed");expect(axios.post).toHaveBeenCalledTimes(1);
});
test("read-only billing cannot initiate checkout",async()=>{
  canManage=false;render(<WABilling/>);const button=await screen.findByRole("button",{name:"Pay with Razorpay"});expect(button.disabled).toBe(true);fireEvent.click(button);expect(axios.post).not.toHaveBeenCalled();
});
test("a disconnected billing API stays visible without a static-host fallback",async()=>{
  axios.get.mockRejectedValue(new Error("offline"));render(<WABilling/>);await screen.findByText(/Billing is unavailable/);expect(axios.get.mock.calls.every(([url])=>url.startsWith("http"))).toBe(true);
});
test("pending signup offers payment or an explicit free-plan continuation",async()=>{
  pendingPlan="starter";axios.post.mockResolvedValue({data:{success:true}});render(<WABilling/>);
  await screen.findByRole("region",{name:"Complete signup payment"});expect(openRazorpayCheckout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button",{name:"Continue on the free plan"}));
  await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith("/whatsapp",{replace:true}));
  expect(axios.post.mock.calls[0][0]).toMatch(/\/billing\/onboarding\/skip$/);expect(openRazorpayCheckout).not.toHaveBeenCalled();
});

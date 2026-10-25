import React from "react";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import axios from "axios";
import WAPlanModal from "./WAPlanModal";
const mockNavigate=jest.fn();
jest.mock("axios",()=>({get:jest.fn(),post:jest.fn()}));
jest.mock("../auth/AuthContext",()=>({useAuth:()=>({user:{id:1,tenant_id:7,plan:"free"}})}));
jest.mock("react-router-dom",()=>({useNavigate:()=>mockNavigate}));
test("plan modal uses catalog data and hands payment to the real billing page",async()=>{
  axios.get.mockImplementation(async url=>({data:url.endsWith("/plans")?{plans:[{id:"free",name:"Free",features:[]},{id:"growth",name:"Growth",price:"INR 3999",features:[]}]}:{tenant:{id:7,plan:"free"},usage:{}}}));
  const close=jest.fn();render(<WAPlanModal isOpen onClose={close}/>);
  const review=await screen.findByRole("button",{name:"Review Growth"});await waitFor(()=>expect(review.disabled).toBe(false));fireEvent.click(review);
  expect(close).toHaveBeenCalled();expect(mockNavigate).toHaveBeenCalledWith("/whatsapp/billing?plan=growth");expect(axios.post).not.toHaveBeenCalled();
});

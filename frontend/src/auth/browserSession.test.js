import axios from "axios";
import { API } from "../config/api";
import { installBrowserSession, confirmBrowserSession } from "./browserSession";
import { portalApi } from "../utils/clientPortalApi";

beforeEach(() => localStorage.clear());
const adapter = async config => ({ config, data: {}, status: 200, statusText: "OK", headers: {} });

test("backend requests follow the selected workspace without forwarding credentials to external services", async () => {
  localStorage.setItem("user", JSON.stringify({ cookieSession: true }));
  localStorage.setItem("active_tenant_id", "12");
  localStorage.setItem("active_branch_id", "34");
  const client = axios.create({ adapter });
  installBrowserSession(client);
  const first = await client.get(`${API}/api/v2/me`, { headers: { Authorization: "Bearer null" } });
  expect(first.config.withCredentials).toBe(true);
  expect(first.config.headers.Authorization).toBeUndefined();
  expect(first.config.headers["x-tenant-id"]).toBe("12");
  expect(first.config.headers["x-branch-id"]).toBe("34");
  localStorage.setItem("active_tenant_id", "56");localStorage.removeItem("active_branch_id");
  const switched = await client.get(`${API}/api/v2/me`);
  expect(switched.config.headers["x-tenant-id"]).toBe("56");
  expect(switched.config.headers["x-branch-id"]).toBeUndefined();
  const external = await client.get("https://external.fixture.test/resource");
  expect(external.config.withCredentials).not.toBe(true);
  expect(external.config.headers["x-tenant-id"]).toBeUndefined();
  expect(external.config.headers["X-Browser-Session"]).toBeUndefined();
});

test("staff portal uses browser cookies while customer portal retains its separate credential", async () => {
  localStorage.setItem("user", JSON.stringify({ cookieSession: true }));
  sessionStorage.setItem("client_portal_token", "customer-fixture-token");
  const staff = portalApi(true), customer = portalApi(false);
  const staffResponse = await staff.get("/clients", { adapter });
  expect(staffResponse.config.withCredentials).toBe(true);
  const customerResponse = await customer.get("/profile", { adapter });
  expect(customerResponse.config.headers.Authorization).toBe("Bearer customer-fixture-token");
  expect(customerResponse.config.withCredentials).not.toBe(true);
});
test("cookie authentication is checked before the caller publishes the new profile",async()=>{
  const previousFetch=global.fetch;
  global.fetch=jest.fn().mockResolvedValue({ok:true,status:200,json:async()=>({success:true,user:{id:7}})});
  try{
    const data={cookieSession:true,user:{id:7}};
    await expect(confirmBrowserSession(data)).resolves.toBe(data);
    expect(global.fetch.mock.calls[0][1].credentials).toBe("include");
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
    global.fetch.mockResolvedValue({ok:false,status:401,json:async()=>({})});
    await expect(confirmBrowserSession(data)).rejects.toMatchObject({code:"BROWSER_SESSION_UNAVAILABLE"});
  }finally{global.fetch=previousFetch;}
});
test("a cookie for another account cannot confirm a new login",async()=>{
  const previousFetch=global.fetch;global.fetch=jest.fn().mockResolvedValue({ok:true,status:200,json:async()=>({success:true,user:{id:99}})});
  try{await expect(confirmBrowserSession({cookieSession:true,user:{id:7}})).rejects.toMatchObject({code:"BROWSER_SESSION_UNAVAILABLE"});}finally{global.fetch=previousFetch;}
});
test("bearer authentication keeps its existing flow",async()=>{
  const data={token:"fixture-only",user:{id:7}};await expect(confirmBrowserSession(data)).resolves.toBe(data);
});

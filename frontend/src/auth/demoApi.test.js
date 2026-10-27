import axios from "axios";
import { API } from "../config";
import { installBrowserSession } from "./browserSession";
import { buildOfflineDemoSession, startDirectDemoSession } from "./demoSession";
import { demoAdapter, getDemoRecords, resetDemoData } from "./demoApi";

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("user",JSON.stringify(buildOfflineDemoSession())); });

test("demo starts locally without creating backend users in any environment", async () => {
  const post=jest.spyOn(axios,"post");
  try {
    expect(await startDirectDemoSession(API,"employee")).toMatchObject({isStrictDemo:true,id:-2,role:"employee",cookieSession:false});
    expect(post).not.toHaveBeenCalled();
  } finally { post.mockRestore(); }
});

test("the existing API client handles demo data locally without authenticated network requests", async () => {
  const network = jest.fn();
  const client=axios.create({baseURL:API,adapter:network});installBrowserSession(client);
  const response=await client.get("/api/v2/me",{headers:{Authorization:"Bearer private"}});
  expect(response.data.activeOrganization.id).toBe(-1);
  expect(response.config.withCredentials).toBe(false);
  expect(response.config.headers.Authorization).toBeUndefined();
  expect(network).not.toHaveBeenCalled();
});

test("sample contacts can be created, edited and deleted without changing real fixtures", async () => {
  const before=getDemoRecords("contacts").length;
  const saved=await demoAdapter({url:`${API}/api/wa/contacts`,method:"post",data:JSON.stringify({name:"Sample new customer",phone:"919000000001"})});
  expect(getDemoRecords("contacts")).toHaveLength(before+1);
  await demoAdapter({url:`${API}/api/wa/contacts/${saved.data.id}`,method:"put",data:{name:"Edited sample"}});
  expect(getDemoRecords("contacts").find(row=>row.id===saved.data.id).name).toBe("Edited sample");
  await demoAdapter({url:`${API}/api/wa/contacts/${saved.data.id}`,method:"delete"});
  expect(getDemoRecords("contacts")).toHaveLength(before);
  resetDemoData();expect(getDemoRecords("contacts")).toHaveLength(before);
});

test("demo checkout and live onboarding cannot invoke providers", async () => {
  for(const path of ["/api/v2/billing/checkout","/api/v2/billing/confirm-payment","/api/v2/meta/onboarding/sessions"]){
    await expect(demoAdapter({url:API+path,method:"post",data:{}})).rejects.toMatchObject({code:"DEMO_PREVIEW_ONLY"});
  }
});

test("regular accounts retain the real backend adapter", async () => {
  localStorage.setItem("user",JSON.stringify({id:7,cookieSession:true}));
  const network=jest.fn(async config=>({config,data:{success:true},status:200,headers:{}}));
  const client=axios.create({baseURL:API,adapter:network});installBrowserSession(client);
  await client.get("/api/v2/me");expect(network).toHaveBeenCalledTimes(1);
});

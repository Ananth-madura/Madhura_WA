import {resolveApiOrigin,PRODUCTION_ORIGINS} from "./index";
test("production apps use the dedicated API origin instead of the static frontend",()=>{
  expect(resolveApiOrigin("",{hostname:"live.wa.madhuratech.in",protocol:"https:"},true)).toBe("https://api.madhuratech.in");
  expect(resolveApiOrigin("",{hostname:"workspace-preview.vercel.app",protocol:"https:"},true)).toBe(PRODUCTION_ORIGINS.api);
});
test("explicit origins and local development remain configurable",()=>{
  expect(resolveApiOrigin("https://test.fixture/api///",null,true)).toBe("https://test.fixture/api");
  expect(resolveApiOrigin("",{hostname:"localhost",protocol:"http:"},false)).toBe("http://localhost:5001");
});
test("local API cookies follow the browser hostname, preserving the configured port",()=>{
  expect(resolveApiOrigin("http://192.168.0.106:5001",{hostname:"localhost",protocol:"http:"},false)).toBe("http://localhost:5001");
  expect(resolveApiOrigin("http://localhost:15317",{hostname:"127.0.0.1",protocol:"http:"},true)).toBe("http://127.0.0.1:15317");
  expect(resolveApiOrigin("http://localhost:5001",{hostname:"192.168.0.106",protocol:"http:"},false)).toBe("http://192.168.0.106:5001");
  expect(resolveApiOrigin("http://localhost:5001",{hostname:"live.wa.madhuratech.in",protocol:"https:"},true)).toBe(PRODUCTION_ORIGINS.api);
});

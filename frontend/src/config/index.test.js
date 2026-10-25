import {resolveApiOrigin,PRODUCTION_ORIGINS} from "./index";
test("production apps use the dedicated API origin instead of the static frontend",()=>{
  expect(resolveApiOrigin("",{hostname:"live.wa.madhuratech.in",protocol:"https:"},true)).toBe("https://api.madhuratech.in");
  expect(resolveApiOrigin("",{hostname:"workspace-preview.vercel.app",protocol:"https:"},true)).toBe(PRODUCTION_ORIGINS.api);
});
test("explicit origins and local development remain configurable",()=>{
  expect(resolveApiOrigin("https://test.fixture/api///",null,true)).toBe("https://test.fixture/api");
  expect(resolveApiOrigin("",{hostname:"localhost",protocol:"http:"},false)).toBe("http://localhost:5001");
});

import {loginDestination} from "./loginDestination";
test("new owners resume their saved paid-plan onboarding",()=>{
  expect(loginDestination({nextPath:"/whatsapp/billing?onboarding=1&plan=growth"})).toBe("/whatsapp/billing?onboarding=1&plan=growth");
  expect(loginDestination({nextPath:"/whatsapp"})).toBe("/whatsapp");
});
test("only internal workspace destinations are accepted",()=>{
  for(const path of ["https://outside.test","//outside.test","/whatsapp\\outside.test","/whatsapp\n/invalid"]){
    expect(loginDestination({nextPath:path},`?returnUrl=${encodeURIComponent(path)}`)).toBe("/whatsapp");
  }
  expect(loginDestination({},"?returnUrl=%2Fwhatsapp%2Fflows")).toBe("/whatsapp/flows");
});

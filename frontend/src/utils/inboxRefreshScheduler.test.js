import { createInboxRefreshScheduler } from "./inboxRefreshScheduler";

beforeEach(()=>jest.useFakeTimers());
afterEach(()=>jest.useRealTimers());
const flush=async()=>{await Promise.resolve();await Promise.resolve();};
test("a burst of live events produces one request, then a slow connected poll",async()=>{
  const run=jest.fn().mockResolvedValue(undefined);
  const scheduler=createInboxRefreshScheduler({run,visible:()=>true,connected:()=>true,random:()=>0.5});
  for(let i=0;i<100;i++)scheduler.request();
  jest.advanceTimersByTime(749);expect(run).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);await flush();expect(run).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(119999);expect(run).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);await flush();expect(run).toHaveBeenCalledTimes(2);scheduler.stop();
});
test("hidden tabs do no fetch work and resume on visibility",async()=>{
  let visible=false;const run=jest.fn().mockResolvedValue(undefined);
  const scheduler=createInboxRefreshScheduler({run,visible:()=>visible,connected:()=>false,random:()=>0.5});
  scheduler.request(true);jest.advanceTimersByTime(60000);expect(run).not.toHaveBeenCalled();
  visible=true;scheduler.request(true);jest.advanceTimersByTime(0);await flush();expect(run).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(30000);await flush();expect(run).toHaveBeenCalledTimes(2);scheduler.stop();
});
test("in-flight requests cannot overlap; queued invalidation coalesces and cleanup stops future work",async()=>{
  let finish;const run=jest.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValue(undefined);
  const scheduler=createInboxRefreshScheduler({run,visible:()=>true,connected:()=>true,random:()=>0.5});
  scheduler.request(true);jest.advanceTimersByTime(0);
  for(let i=0;i<100;i++)scheduler.request(true);
  jest.advanceTimersByTime(10000);expect(run).toHaveBeenCalledTimes(1);
  finish();await flush();jest.advanceTimersByTime(750);await flush();expect(run).toHaveBeenCalledTimes(2);
  scheduler.stop();jest.advanceTimersByTime(600000);expect(run).toHaveBeenCalledTimes(2);
});

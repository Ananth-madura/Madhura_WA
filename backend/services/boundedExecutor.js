"use strict";
function createExecutor(concurrency,maxQueue,waitMs=5000) {
  let active=0;
  const waiting=[];
  function launch(job) {
    active++;clearTimeout(job.timer);
    Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{
      active--;const next=waiting.shift();if(next)launch(next);
    });
  }
  return {
    run(work) {
      return new Promise((resolve,reject)=>{
        const job={work,resolve,reject};
        if(active<concurrency)return launch(job);
        if(waiting.length>=maxQueue)return reject(new Error("Provider capacity exceeded"));
        job.timer=setTimeout(()=>{const index=waiting.indexOf(job);if(index>=0)waiting.splice(index,1);reject(new Error("Provider capacity wait expired"));},waitMs);
        waiting.push(job);
      });
    },
    stats:()=>({active,waiting:waiting.length,concurrency,maxQueue}),
  };
}
module.exports={createExecutor};

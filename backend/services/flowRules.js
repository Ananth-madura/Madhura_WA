"use strict";
const OPERATORS=["equals","not_equals","contains","not_contains","starts_with","ends_with","gte","greater_or_equal","greater_than","less_than","less_or_equal","is_numeric","is_not_empty","is_empty","in"];
function compare(rule,vars){
  const value=String(vars[rule.field||rule.variable||rule.subject_key]??"");
  const expected=String(rule.value??"").replace(/\{\{?([\w.]+)\}?\}/g,(all,key)=>Object.hasOwn(vars,key)?String(vars[key]):all);
  const a=value.toLowerCase(),b=expected.toLowerCase(),numeric=value.trim()!==""&&Number.isFinite(Number(value))&&expected.trim()!==""&&Number.isFinite(Number(expected));
  switch(rule.operator||"equals"){
    case "equals":return a===b;
    case "not_equals":return a!==b;
    case "contains":return a.includes(b);
    case "not_contains":return !a.includes(b);
    case "starts_with":return a.startsWith(b);
    case "ends_with":return a.endsWith(b);
    case "greater_than":return numeric&&Number(value)>Number(expected);
    case "less_than":return numeric&&Number(value)<Number(expected);
    case "less_or_equal":return numeric&&Number(value)<=Number(expected);
    case "greater_or_equal":case "gte":return numeric&&Number(value)>=Number(expected);
    case "is_numeric":return value.trim()!==""&&Number.isFinite(Number(value));
    case "is_not_empty":return Boolean(value.trim());
    case "is_empty":return !value.trim();
    case "in":return b.split(",").map(v=>v.trim()).includes(a);
    default:throw new Error("Unsupported condition operator");
  }
}
function evaluate(config,vars){const rules=config.rules?.length?config.rules:[{field:config.variable||config.subject_key||config.field,operator:config.operator,value:config.value}];return config.match==="any"?rules.some(rule=>compare(rule,vars)):rules.every(rule=>compare(rule,vars));}
function openHours(config,now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:config.timezone||"Asia/Kolkata",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
  const day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(parts.weekday),minute=(Number(parts.hour)%24)*60+Number(parts.minute);
  const time=value=>Number(value.slice(0,2))*60+Number(value.slice(3));const start=time(config.start||"09:00"),end=time(config.end||"18:00"),days=config.days||[1,2,3,4,5];
  return start<end?days.includes(day)&&minute>=start&&minute<end:days.includes(day)&&minute>=start||days.includes((day+6)%7)&&minute<end;
}
function secureUrl(template,vars={}){
  const parsed=new URL(template);if(parsed.protocol!=="https:"||parsed.username||parsed.password||/[{}]/.test(parsed.host))throw new Error("Use a fixed HTTPS destination without embedded credentials");
  const value=String(template).replace(/\{\{?([\w.]+)\}?\}/g,(_,key)=>encodeURIComponent(String(vars[key]??"")));
  if(new URL(value).origin!==parsed.origin)throw new Error("Link variables must not change the destination domain");return value;
}
module.exports={OPERATORS,compare,evaluate,openHours,secureUrl};

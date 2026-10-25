import {requireRecords,cachedRecords,validateJsonResponse} from "./apiPayload";
test("HTML application fallbacks never become successful API payloads",()=>{
  expect(()=>validateJsonResponse({data:"<!doctype html><html>App</html>",headers:{"content-type":"text/html"},config:{}})).toThrow("invalid response");
  expect(()=>validateJsonResponse({data:"<html>App</html>",headers:{},config:{}})).toThrow("invalid response");
  const download={data:"<html>Saved file</html>",headers:{"content-type":"text/html"},config:{responseType:"blob"}};
  expect(validateJsonResponse(download)).toBe(download);
});
test("list responses are validated before committing React state",()=>{
  for(const value of ["<!doctype html>",{},undefined,[null],[[]]])expect(()=>requireRecords(value)).toThrow("invalid response");
  const rows=[{id:1,body:"Device chat"}];expect(requireRecords(rows)).toBe(rows);
  expect(cachedRecords({items:rows})).toEqual([]);expect(cachedRecords([null,...rows])).toEqual(rows);
});

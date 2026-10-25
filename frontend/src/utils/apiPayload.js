export function invalidApiResponse(){
  const error=new Error("The backend returned an invalid response. Check the API connection and try again.");
  error.code="INVALID_API_RESPONSE";error.friendlyMessage=error.message;return error;
}
export function requireRecords(value){
  if(!Array.isArray(value)||value.some(item=>!item||typeof item!=="object"||Array.isArray(item)))throw invalidApiResponse();
  return value;
}
export function cachedRecords(value){return Array.isArray(value)?value.filter(item=>item&&typeof item==="object"&&!Array.isArray(item)):[];}
export function validateJsonResponse(response){
  if(["blob","arraybuffer","stream"].includes(response.config?.responseType))return response;
  const type=String(response.headers?.get?.("content-type")||response.headers?.["content-type"]||"");
  if(type.includes("text/html")||(typeof response.data==="string"&&/^\s*(?:<!doctype\s+html|<html\b)/i.test(response.data)))throw invalidApiResponse();
  return response;
}

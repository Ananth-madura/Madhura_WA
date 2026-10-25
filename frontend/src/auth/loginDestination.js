export function loginDestination(data,search=""){
  const requested=new URLSearchParams(search).get("returnUrl");
  const safe=path=>typeof path==="string"&&/^\/whatsapp(?:[/?]|$)/.test(path)&&!/[\\\r\n]/.test(path);
  return safe(requested)?requested:safe(data?.nextPath)?data.nextPath:"/whatsapp";
}

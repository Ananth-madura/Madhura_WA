"use strict";
const rules=require("./flowRules");
const SUPPORTED=new Set(["start","trigger","keyword_trigger","all_inbound_trigger","first_inbound_trigger","send_message","send_buttons","send_list","interactive_menu","collect_input","collect_number","collect_email","collect_date","condition","set_variable","send_template","send_cta","business_hours","contact_lookup","handoff","end","switch","business_action"]);
const parse=value=>{try{return typeof value==="string"?JSON.parse(value):value;}catch(_){throw fail("Configuration must be valid JSON");}};
const fail=message=>Object.assign(new Error(message),{status:400});
SUPPORTED.add("ai_reply");
SUPPORTED.add("send_media");
function options(node){
  const c=node.config||{};
  if(c.sections!==undefined&&!Array.isArray(c.sections))throw fail("Menu sections must be an array");
  const sections=c.sections?.length?c.sections:[{buttons:c.buttons||c.rows||c.options||[]}];
  return sections.flatMap(s=>{const list=s?.buttons||s?.rows||s?.options||[];if(!Array.isArray(list)||list.some(o=>!o||typeof o!=="object"))throw fail("Menu options must be an array of objects");return list;}).map((o,i)=>({...o,id:String(o.reply_id||o.id||`option_${i+1}`),title:String(o.title||o.label||o.text||""),next_node_key:o.next_node_key||o.nextNodeId||o.next_node||o.target_node}));
}
function links(node){const c=node.config||{};return [c.next_node_key,c.true_next,c.false_next,c.open_next,c.closed_next,c.invalid_next,c.error_next,c.fallback_node_key,...(c.cases||[]).map(r=>r.next_node_key),...options(node).map(o=>o.next_node_key)].filter(Boolean);}
function normalize(input,{publish=false}={}){
  if(!input||typeof input!=="object"||!String(input.name||"").trim()||String(input.name).length>255)throw fail("Provide a flow name up to 255 characters");
  if(!Array.isArray(input.nodes)||!input.nodes.length||input.nodes.length>100)throw fail("A flow needs 1 to 100 steps");
  if(input.nodes.some(node=>!node||typeof node.node_type!=="string"))throw fail("Each step needs a supported type");
  if(Buffer.byteLength(JSON.stringify(input))>262144)throw fail("Flow definition exceeds 256 KiB");
  const flow={name:String(input.name).trim(),description:String(input.description||"").slice(0,4000),entry_node_key:input.entry_node_key||"start",trigger_type:input.trigger_type||"keyword",trigger_config:parse(input.trigger_config)||{},nodes:input.nodes.map(n=>{
    const c=parse(n.config)||{};
    if(typeof c!=="object"||Array.isArray(c))throw fail("Step configuration must be an object");
    if(n.node_type.startsWith("collect_")){c.variable=c.var_key||c.variable||c.variable_name||"answer";c.var_key=c.variable;c.prompt=c.prompt_text||c.prompt||c.text||"";c.prompt_text=c.prompt;c.validation=c.validation_type||c.validation||n.node_type.replace("collect_","");c.validation_type=c.validation;}
    if(n.node_type==="set_variable"){c.variable=c.var_key||c.variable||c.variable_name||"value";c.var_key=c.variable;c.value=c.var_value??c.value??"";c.var_value=c.value;}
    if(n.node_type==="condition")c.variable=c.subject_key||c.variable||c.variable_name||c.field||"input";
    return {...n,node_type:n.node_type.startsWith("collect_")?"collect_input":n.node_type,config:c};
  })};
  if(!["keyword","manual","all_inbound","first_inbound"].includes(flow.trigger_type))throw fail("Choose a keyword, manual, all inbound or first inbound trigger");
  const keys=new Set();
  for(const node of flow.nodes){
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(node.node_key)||keys.has(node.node_key))throw fail("Each step needs a unique key using letters, numbers, underscores or hyphens");
    keys.add(node.node_key);
    if(!SUPPORTED.has(node.node_type))throw fail(`Step ${node.node_key}: ${node.node_type} is not supported by the shared-number runtime`);
    if(!node.config||typeof node.config!=="object"||Array.isArray(node.config))throw fail("Step configuration must be an object");
    if(node.config.max_attempts!==undefined&&(!Number.isInteger(node.config.max_attempts)||node.config.max_attempts<1||node.config.max_attempts>5))throw fail("Retry attempts must be between 1 and 5");
    if(node.config.retry_message!==undefined&&(typeof node.config.retry_message!=="string"||node.config.retry_message.length>1024))throw fail("Retry messages must be text up to 1024 characters");
    if(node.node_type==="condition"){
      const conditions=node.config.rules??[{field:node.config.variable,operator:node.config.operator||"equals"}];
      if(!Array.isArray(conditions)||!conditions.length||conditions.length>10||conditions.some(r=>!r||!rules.OPERATORS.includes(r.operator||"equals")||typeof r.field!=="string"||!r.field.trim()))throw fail("Use 1 to 10 conditions with supported operators and variable names");
      if(node.config.match&&!['all','any'].includes(node.config.match))throw fail("Choose all or any conditions");
    }
    if(node.node_type==="switch"){
      const c=node.config;
      if(typeof c.variable!=="string"||!c.variable.trim()||!Array.isArray(c.cases)||!c.cases.length||c.cases.length>10||c.cases.some(r=>!r||!rules.OPERATORS.includes(r.operator||"equals")||typeof r.value!=="string"))throw fail("Switch needs a variable and 1 to 10 valid routes");
      if(publish&&(!c.fallback_node_key||c.cases.some(r=>!r.next_node_key)))throw fail("Connect every switch route and its fallback");
    }
    if(node.node_type==="business_action")require("./flowIntegrations").validate(node.config,{publish});
    if(node.node_type==="ai_reply"){
      const c=node.config;
      if(typeof c.prompt!=="string"||!c.prompt.trim()||c.prompt.length>2000||!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(c.output_variable||"")||["constructor","prototype","name","input","last_input"].includes(c.output_variable))throw fail("AI reply needs a prompt and a custom output variable");
      if(publish&&(!c.next_node_key||!c.error_next))throw fail("Connect AI reply success and failure routes");
    }
    if(node.node_type==="send_media"){
      const c=node.config;
      if(!["image","video","audio","document"].includes(c.media_type))throw fail("Choose an image, video, audio or document");
      if(publish){try{rules.secureUrl(c.url,{});}catch(_){throw fail("Media needs a fixed HTTPS destination");}}
    }
    if(node.node_type==="collect_input"){
      const c=node.config;
      if(!["input","none","text","number","email","date","phone","reference","yes_no","choice"].includes(c.validation))throw fail("Unsupported input validation");
      if(c.max_attempts!==undefined&&(!Number.isInteger(c.max_attempts)||c.max_attempts<1||c.max_attempts>5))throw fail("Retry attempts must be between 1 and 5");
      for(const name of ["min_length","max_length"])if(c[name]!==undefined&&(!Number.isInteger(c[name])||c[name]<0||c[name]>2000))throw fail("Input lengths must be between 0 and 2000");
      if((c.min_length||0)>(c.max_length??2000))throw fail("Minimum input length cannot exceed maximum");
      if(c.min!==undefined&&!Number.isFinite(c.min)||c.max!==undefined&&!Number.isFinite(c.max)||c.min!==undefined&&c.max!==undefined&&c.min>c.max)throw fail("Use valid minimum and maximum numbers");
      if(c.validation==="choice"&&(!Array.isArray(c.choices)||!c.choices.length||c.choices.length>20||c.choices.some(v=>typeof v!=="string"||!v.trim()||v.length>100)))throw fail("Provide 1 to 20 allowed answers");
    }
    if(node.node_type==="business_hours"){
      const c=node.config;
      try{new Intl.DateTimeFormat("en",{timeZone:c.timezone||"Asia/Kolkata"});}catch(_){throw fail("Select a valid IANA timezone");}
      if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.start||"")||!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.end||"")||c.start===c.end||!Array.isArray(c.days)||!c.days.length||c.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw fail("Configure working days and distinct opening/closing times");
    }
    if(node.node_type==="send_cta"&&publish){try{rules.secureUrl(node.config.url,{});}catch(_){throw fail("The link step needs a fixed HTTPS destination");}if(!String(node.config.text||"").trim()||!String(node.config.button_text||"").trim()||node.config.button_text.length>20)throw fail("Link steps need message text and a button label up to 20 characters");}
    if(node.node_type==="send_template"&&(!Array.isArray(node.config.parameters||[])||(node.config.parameters||[]).length>20))throw fail("Template parameters must be an array of up to 20 values");
    if(node.config.contact_field&&!["name","email"].includes(node.config.contact_field))throw fail("Only a contact name or email can be saved from an input step");
    if(["__proto__","constructor","prototype"].includes(node.config.variable||node.config.variable_name||""))throw fail("Reserved variable name");
    if(["send_buttons","send_list","interactive_menu"].includes(node.node_type)){
      const items=options(node),max=node.node_type==="send_buttons"?3:10;
      if(publish&&!items.length||items.length>max||new Set(items.map(o=>o.id)).size!==items.length)throw fail(`Step ${node.node_key}: choose 1 to ${max} unique options`);
      if(items.some(o=>publish&&(!o.title||!o.next_node_key)||o.title.length>(node.node_type==="send_buttons"?20:24)||o.id.length>200))throw fail(`Step ${node.node_key}: options need short titles and connected destinations`);
    }
    if(publish){
      if(node.node_type==="send_message"&&!String(node.config.text||"").trim())throw fail(`Step ${node.node_key} needs message text`);
      if(["send_buttons","send_list","interactive_menu"].includes(node.node_type)&&(!String(node.config.text||node.config.message?.text||"").trim()||String(node.config.text||node.config.message?.text).length>1024))throw fail(`Step ${node.node_key} needs menu text up to 1024 characters`);
      if(node.node_type.startsWith("collect_")&&!String(node.config.prompt||node.config.text||"").trim())throw fail(`Step ${node.node_key} needs a question`);
      if(node.node_type==="condition"&&(!node.config.true_next||!node.config.false_next))throw fail("Connect both condition routes");
      if(node.node_type==="business_hours"&&(!node.config.open_next||!node.config.closed_next))throw fail("Connect the open and closed business-hours routes");
      if(!["end","handoff","send_buttons","send_list","interactive_menu","condition","business_hours","switch","business_action"].includes(node.node_type)&&!node.config.next_node_key)throw fail(`Step ${node.node_key} needs a next step`);
    }
  }
  if(!keys.has(flow.entry_node_key))throw fail("The entry step does not exist");
  for(const node of flow.nodes)for(const target of links(node))if(!keys.has(target))throw fail(`Step ${node.node_key} points to missing step ${target}`);
  if(publish){
    const visited=new Set(),todo=[flow.entry_node_key];while(todo.length){const key=todo.pop();if(visited.has(key))continue;visited.add(key);todo.push(...links(flow.nodes.find(n=>n.node_key===key)));}
    if(visited.size!==keys.size)throw fail("Remove or connect unreachable steps before publishing");
    if(flow.trigger_type==="keyword"&&!(Array.isArray(flow.trigger_config.keywords)&&flow.trigger_config.keywords.some(k=>typeof k==="string"&&k.trim())))throw fail("Set at least one trigger keyword");
  }
  return flow;
}
function interpolate(text,vars){return String(text||"").replace(/\{\{?([\w.]+)\}?\}/g,(all,key)=>Object.hasOwn(vars,key)?String(vars[key]):all).slice(0,4096);}
function step(flow,input="",state=null,initial={},execution={}){
  if(state&&Buffer.byteLength(JSON.stringify(state))>20000)throw fail("Preview state is too large; restart the preview");
  const nodes=new Map(flow.nodes.map(n=>[n.node_key,n]));
  const vars=Object.assign(Object.create(null),initial,state?.vars||{}),messages=[],logs=[];
  let key=state?.currentNodeKey||flow.entry_node_key,waiting=Boolean(state?.currentNodeKey),turns=0;
  const text=String(input||"").trim().slice(0,2000);
  const retry=(message,c)=>{
    vars._invalid_count=(Number(vars._invalid_count)||0)+1;
    if(vars._invalid_count>=(c.max_attempts||3))return c.invalid_next?step({...flow,entry_node_key:c.invalid_next},"",null,vars,{...execution,contact:execution.contact||initial}):{messages:[{sender:"bot",type:"handoff",text:"A team member will help you continue."}],vars,currentNodeKey:null,isEnded:true,isHandedOff:true,logs};
    return {messages:[{sender:"bot",type:"text",text:message}],vars,currentNodeKey:key,waiting:true,isEnded:false,logs};
  };
  if(waiting){
    const node=nodes.get(key);if(!node)throw fail("The waiting step no longer exists; restart this flow");
    const c=node.config;
    if(node.node_type.startsWith("collect_")){
      const validation=c.validation||node.node_type.replace("collect_","");
      const valid=text&&(!(validation==="number")||Number.isFinite(Number(text))&&(c.min===undefined||Number(text)>=c.min)&&(c.max===undefined||Number(text)<=c.max))&&(!(validation==="email")||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))&&(!(validation==="date")||/^\d{4}-\d{2}-\d{2}$/.test(text)&&!Number.isNaN(Date.parse(text))&&new Date(text).toISOString().slice(0,10)===text);
      const formats={phone:/^\+?[1-9]\d{6,14}$/,reference:/^[A-Za-z0-9][A-Za-z0-9 _/-]{1,63}$/,yes_no:/^(yes|no)$/i};
      if(!valid||formats[validation]&&!formats[validation].test(text)||validation==="choice"&&!c.choices.some(value=>value.toLowerCase()===text.toLowerCase())||text.length<(c.min_length||0)||text.length>(c.max_length??2000)||validation==="number"&&c.integer&&!Number.isInteger(Number(text))||c.contact_field&&text.length>255||c.contact_field==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))return retry(c.retry_message||"Please enter a valid answer.",c);
      vars[c.variable||c.variable_name||"answer"]=text;vars.last_input=text;vars.input=text;key=c.next_node_key;
    }else{
      const items=options(node),choice=items.find(o=>o.id===text)||items.find(o=>o.title.toLowerCase()===text.toLowerCase())||(/^\d+$/.test(text)?items[Number(text)-1]:null);
      if(!choice)return retry("Choose one of the displayed options.",c);
      vars.selected_option=choice.title;vars["selected.option"]=choice.title;key=choice.next_node_key;
    }
    vars._invalid_count=0;
  }
  while(key&&turns++<40){
    const node=nodes.get(key);if(!node)throw fail("Flow destination does not exist");const c=node.config;logs.push(key);
    if(["send_buttons","send_list","interactive_menu"].includes(node.node_type)){
      const items=options(node).map(o=>({...o,title:interpolate(o.title,vars)}));
      return {messages:[...messages,{sender:"bot",type:node.node_type,text:interpolate(c.text||c.message?.text,vars),options:items,buttons:node.node_type==="send_buttons"?items:undefined,sections:node.node_type==="send_buttons"?undefined:[{title:"Options",rows:items}]}],vars,currentNodeKey:key,waiting:true,isEnded:false,logs};
    }
    if(node.node_type.startsWith("collect_"))return {messages:[...messages,{sender:"bot",type:"text",text:interpolate(c.prompt||c.text,vars)}],vars,currentNodeKey:key,waiting:true,isEnded:false,logs};
    if(node.node_type==="switch"){
      key=c.cases.find(route=>rules.compare({...route,field:c.variable},vars))?.next_node_key||c.fallback_node_key;continue;
    }
    if(["business_action","ai_reply"].includes(node.node_type)){
      if(execution.live)return {messages,vars,logs,action:node,isEnded:false};
      for(const name of Object.keys(c.outputs||{}))vars[name]=`[Preview: ${name}]`;
      if(node.node_type==="ai_reply")vars[c.output_variable]="[Preview: AI response]";
      vars["integration.status"]="preview";
      key=execution.previewActionError?c.error_next:c.next_node_key;continue;
    }
    if(node.node_type==="send_message")messages.push({sender:"bot",type:"text",text:interpolate(c.text,vars)});
    if(node.node_type==="send_media")messages.push({sender:"bot",type:"media",media_type:c.media_type,url:rules.secureUrl(c.url,vars),text:interpolate(c.caption,vars),filename:interpolate(c.filename,vars)});
    if(node.node_type==="send_template")messages.push({sender:"bot",type:"template",template_id:c.template_id,template_name:c.template_name,parameters:c.parameters||[],text:"Template delivery requires verified Meta approval for this sender."});
    if(node.node_type==="send_cta"){
      let url;try{url=rules.secureUrl(c.url,vars);}catch(_){throw fail("Configure a fixed HTTPS destination before previewing this link step");}
      messages.push({sender:"bot",type:"cta_url",text:interpolate(c.text,vars),url,button_text:interpolate(c.button_text,vars),buttons:[{type:"url",title:interpolate(c.button_text,vars),url}]});
    }
    if(node.node_type==="contact_lookup")for(const field of ["customer.name","customer.phone","customer.email","contact.exists"])vars[field]=(execution.contact||initial)[field]??(field==="contact.exists"?false:"");
    if(node.node_type==="business_hours"){const open=rules.openHours(c,execution.now||new Date());vars["business.is_open"]=open;key=open?c.open_next:c.closed_next;continue;}
    if(node.node_type==="set_variable")vars[c.variable||c.variable_name||"value"]=interpolate(c.value,vars);
    if(node.node_type==="condition"){
      const match=rules.evaluate(c,vars);
      key=match?c.true_next:c.false_next;continue;
    }
    if(node.node_type==="handoff"){if(c.note)messages.push({sender:"bot",type:"handoff",text:interpolate(c.note,vars)});return {messages,vars,currentNodeKey:null,isEnded:true,isHandedOff:true,logs};}
    if(node.node_type==="end")return {messages,vars,currentNodeKey:null,isEnded:true,logs};
    key=c.next_node_key;
  }
  if(turns>=40)throw fail("Flow exceeded 40 steps in one turn; check for an automatic loop");
  return {messages,vars,currentNodeKey:null,isEnded:true,logs};
}
async function execute(flow,input,state,initial,execution){
  let result=step(flow,input,state,initial,{...execution,live:true}),count=0;
  const logs=[];
  while(true){
    count+=result.logs.length;
    if(count>40)throw fail("Flow exceeded 40 steps in one turn; check for an automatic loop");
    if(execution.onVisit)await execution.onVisit(result.logs);
    await execution.onMessages(result.messages,result.vars);
    logs.push(...result.logs);
    if(!result.action)return {...result,logs};
    const {config:c}=result.action;
    let next=c.next_node_key;
    try{
      const outputs=await execution.onAction(result.action,result.vars);
      if(Buffer.byteLength(JSON.stringify({...result.vars,...outputs}))>16384)throw fail("Action outputs exceed the workflow memory limit");
      Object.assign(result.vars,outputs,{"integration.status":"success"});
    }catch(error){
      if(error.flowInterrupted)throw error;
      result.vars["integration.status"]="failed";
      for(const name of Object.keys(c.outputs||{}))delete result.vars[name];
      if(c.output_variable)delete result.vars[c.output_variable];
      next=c.error_next;
      if(!next)throw error;
    }
    result=step({...flow,entry_node_key:next},"",null,result.vars,{...execution,contact:initial,live:true});
  }
}
module.exports={normalize,step,execute,options,interpolate,SUPPORTED};

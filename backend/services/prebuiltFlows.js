"use strict";
const node=(key,type,config,index)=>({node_key:key,node_type:type,config,position_x:160,position_y:80+index*140});
const definitions=[
  ["welcome","Welcome and routing","menu",["Sales","Customer support","Speak to a person"]],
  ["sales","Sales qualification","sales",["Which product or service interests you?","What budget range should our team consider?"]],
  ["booking","Appointment request","book",["Which service would you like to book?","What date do you prefer? Use YYYY-MM-DD."]],
  ["support","Support intake","support",["Briefly describe the issue.","What product or order reference should we use?"]],
  ["quote","Quote request","quote",["What product or service do you need?","What quantity or scope should we quote?"]],
  ["order","Order enquiry","order",["What is your order reference?","What would you like our team to check?"]],
  ["feedback","Customer feedback","feedback",["How would you rate your experience from 1 to 5?","What could we improve?"]],
  ["callback","Callback request","callback",["What time would you prefer a callback?","What should our team help you with?"]],
  ["onboarding","New customer onboarding","join",["Which service are you joining?","What email address should our team use?"]],
  ["returns","Return or cancellation request","return",["What order or booking reference is this for?","Please share the reason for your request."]],
];
module.exports=definitions.map(([key,name,keyword,questions])=>{
  const menu=key==="welcome";
  const nodes=[node("start","start",{next_node_key:menu?"menu":"question_1"},0)];
  if(menu){
    nodes.push(node("menu","send_buttons",{text:"Hello {name}. How can our team help?",buttons:questions.map((title,i)=>({reply_id:`route_${i+1}`,title,next_node_key:`route_${i+1}`}))},1));
    questions.forEach((title,i)=>nodes.push(node(`route_${i+1}`,"handoff",{note:`Your ${title.toLowerCase()} request is ready for the assigned team member.`},i+2)));
  }else{
    questions.forEach((prompt,i)=>nodes.push(node(`question_${i+1}`,key==="booking"&&i===1?"collect_date":key==="onboarding"&&i===1?"collect_email":key==="feedback"&&i===0?"collect_number":"collect_input",{prompt,variable:`${key}_${i+1}`,...(key==="feedback"&&i===0?{min:1,max:5}:{}),next_node_key:i===questions.length-1?"summary":`question_${i+2}`},i+1)));
    if(key==="onboarding")nodes.find(n=>n.node_key==="question_2").config.contact_field="email";
    nodes.push(node("summary","send_message",{text:`Your request:\n${questions.map((q,i)=>`${i+1}. {${key}_${i+1}}`).join("\n")}\nYour assigned team member will review it. This does not confirm a booking, refund or order change.`,next_node_key:"handoff"},3));
    nodes.push(node("handoff","handoff",{note:"Connecting you with your assigned team member."},4));
  }
  return {key,name,description:"Editable shared-number starter. Responses stay in transient memory and device chat; handoff does not execute business transactions.",trigger_type:"keyword",trigger_config:{keywords:[keyword]},entry_node_key:"start",nodes};
});

"use strict";
const n=(node_key,node_type,config,i)=>({node_key,node_type,config,position_x:160,position_y:80+i*140});
module.exports=[
  {key:"account_service",name:"Account service routing",description:"Routes service enquiries to a secure customer portal or an assigned employee. Configure your organization's portal URL before publishing.",trigger_type:"keyword",trigger_config:{keywords:["account help"]},entry_node_key:"start",nodes:[
    n("start","contact_lookup",{next_node_key:"menu"},0),
    n("menu","send_buttons",{text:"Hello {customer.name}. Choose a service. Do not share passwords, PINs or verification codes in this chat.",buttons:[{id:"portal",title:"Secure portal",next_node_key:"portal"},{id:"person",title:"Speak to a person",next_node_key:"person"}]},1),
    n("portal","send_cta",{text:"Continue in our secure customer portal.",button_text:"Open secure portal",url:"",next_node_key:"end"},2),
    n("person","handoff",{note:"Your assigned employee will help with your service enquiry."},3),n("end","end",{},4)]},
  {key:"dispute_intake",name:"Dispute enquiry intake",description:"Collects a non-sensitive reference and a description for human review. Does not dispute a transaction or move funds.",trigger_type:"keyword",trigger_config:{keywords:["dispute"]},entry_node_key:"start",nodes:[
    n("start","collect_input",{prompt_text:"Enter your existing enquiry reference only. Do not enter a full card/account number, PIN or OTP.",var_key:"request_reference",validation_type:"reference",max_length:64,max_attempts:2,next_node_key:"details"},0),
    n("details","collect_input",{prompt_text:"Briefly describe what you need our team to review.",var_key:"request_details",validation_type:"none",min_length:10,max_length:500,next_node_key:"handoff"},1),
    n("handoff","handoff",{note:"A team member will review your enquiry. This chat has not changed any transaction."},2)]},
  {key:"branch_hours",name:"Branch hours and callback routing",description:"Routes current contact enquiries using a timezone and office schedule, including overnight shifts.",trigger_type:"keyword",trigger_config:{keywords:["branch help"]},entry_node_key:"start",nodes:[
    n("start","contact_lookup",{next_node_key:"hours"},0),n("hours","business_hours",{timezone:"Asia/Kolkata",days:[1,2,3,4,5],start:"09:00",end:"18:00",open_next:"available",closed_next:"callback"},1),
    n("available","handoff",{note:"Our office is open. Your assigned employee will assist you."},2),
    n("callback","collect_input",{prompt_text:"Our office is closed. What callback time would you prefer? A team member must confirm it.",var_key:"callback_time",validation_type:"none",min_length:3,max_length:100,next_node_key:"review"},3),
    n("review","handoff",{note:"Your callback preference is ready for an employee to review when available."},4)]},
];

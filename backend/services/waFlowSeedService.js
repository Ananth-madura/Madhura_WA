"use strict";
async function seedAll(){return {success:true,automaticActivation:false};}
async function seedFlowBots(tenantId,userId){
  if(!Number.isInteger(Number(tenantId))||Number(tenantId)<1||!Number.isInteger(Number(userId))||Number(userId)<1)throw new Error("Explicit organization and administrator are required");
  return require("./flowStore").createFlowStore(require("../config/database")).seed(Number(tenantId),Number(userId));
}
module.exports={seedAll,seedFlowBots};

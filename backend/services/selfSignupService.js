"use strict";
const bcrypt=require("bcryptjs"),crypto=require("node:crypto");
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
function createSignupService(db,organizations){
  return async input=>{
    const value=(key,max=255)=>{
      if(input[key]!=null&&typeof input[key]!=="string")throw fail(`Invalid ${key}`);
      const text=String(input[key]||"").trim();if(text.length>max)throw fail(`${key} is too long`);return text;
    };
    const first=value("first_name",100),last=value("last_name",100),email=value("email").toLowerCase();
    const password=input.password;
    if(!first||!email||typeof password!=="string"||password.length<6||Buffer.byteLength(password)>72)throw fail("Name, email and a password of 6 to 72 bytes are required");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))throw fail("Please provide a valid email address");
    const company=value("company_name")||`${first}'s Workspace`,plan=value("plan",50).toLowerCase()||"free";
    const legal=value("legal_name")||company,brand=value("brand_name")||company,mobile=value("mobile_number",30)||null;
    const branch=value("branch_name")||"Head Office (Main)",code=value("branch_code",40)||"HQ-01",timezone=value("timezone",64)||"Asia/Kolkata";
    try{new Intl.DateTimeFormat("en",{timeZone:timezone});}catch(_){throw fail("Invalid timezone");}
    if(db.isSqlite)throw fail("Workspace signup requires MySQL",503);
    const hash=await bcrypt.hash(password,10);
    const connection=await new Promise((resolve,reject)=>db.getConnection((error,result)=>error?reject(error):resolve(result)));
    const client=connection.promise(),q=async(sql,args=[])=>(await client.query(sql.replace(/INSERT OR IGNORE/gi,"INSERT IGNORE"),args))[0];
    try{
      await client.beginTransaction();
      if((await q("SELECT id FROM users WHERE email = ? LIMIT 1",[email])).length)throw fail("An account with this email already exists. Please sign in.",409);
      const employeeId=`EMP-${crypto.randomBytes(8).toString("hex")}`;
      const result=await q("INSERT INTO users (first_name,last_name,email,user_password,role,status,emp_id,mobile_number,tenant_id) VALUES (?,?,?,?,'admin','active',?,?,0)",[first,last,email,hash,employeeId,mobile]);
      const org=await organizations.createOrganization({name:company,legal_name:legal,brand_name:brand,ownerUserId:result.insertId,plan,branch_name:branch,branch_code:code,timezone},q);
      await q("UPDATE users SET tenant_id = ? WHERE id = ?",[org.id,result.insertId]);
      await client.commit();
      return {org,branch:{id:org.head_office_branch_id,name:org.branch_name,code:org.branch_code,is_head_office:1},user:{id:result.insertId,name:`${first} ${last}`.trim(),first_name:first,last_name:last,email,role:"admin",tenant_id:org.id,tenant_name:org.name,branch_id:org.head_office_branch_id,branch_name:org.branch_name,branch_code:org.branch_code,plan:org.plan}};
    }catch(error){await client.rollback();if(error.code==="ER_DUP_ENTRY")throw fail("Account details already exist. Please sign in or use a different email.",409);throw error;}
    finally{connection.release();}
  };
}
module.exports={createSignupService};

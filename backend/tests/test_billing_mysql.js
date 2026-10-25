"use strict";
const assert=require("node:assert/strict"),mysql=require("mysql2"),http=require("node:http"),crypto=require("node:crypto");
async function main(){
  const port=Number(process.env.INBOX_TEST_MYSQL_PORT);
  if(!Number.isInteger(port)||port<1024||port>65535||port===3306)throw new Error("Set an isolated INBOX_TEST_MYSQL_PORT; production/default ports are refused");
  const config={host:"127.0.0.1",port,user:process.env.INBOX_TEST_MYSQL_USER||"root",password:process.env.INBOX_TEST_MYSQL_PASSWORD||""};
  const admin=mysql.createConnection(config).promise(),name=`billing_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE \`${name}\``);
  const pool=mysql.createPool({...config,database:name,connectionLimit:12}),sql=pool.promise();let provider;
  try{
    for(const statement of [
      "CREATE TABLE tenants (id INT PRIMARY KEY,name VARCHAR(60),plan VARCHAR(50),plan_status VARCHAR(30),pending_plan_id VARCHAR(50),max_branches INT,max_seats INT,max_senders INT,max_monthly_messages INT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE plans (id VARCHAR(50) PRIMARY KEY,name VARCHAR(60),price_inr DECIMAL(10,2),is_active INT,max_branches INT,max_seats INT,max_senders INT,max_monthly_messages INT)",
      "CREATE TABLE users (id INT PRIMARY KEY,email VARCHAR(90),first_name VARCHAR(60))",
      "CREATE TABLE billing_orders (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,user_id INT,plan_id VARCHAR(50),`interval` VARCHAR(20),amount_minor INT,currency VARCHAR(10),provider VARCHAR(30),provider_order_id VARCHAR(191) UNIQUE,receipt VARCHAR(191),status VARCHAR(20),source VARCHAR(30),payment_id VARCHAR(191),paid_at TIMESTAMP NULL,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE usage_events (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,meter_key VARCHAR(60),quantity INT,external_event_id VARCHAR(191),UNIQUE(meter_key,external_event_id))",
      "CREATE TABLE subscriptions (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,plan_id VARCHAR(50),provider VARCHAR(30),provider_sub_id VARCHAR(191),status VARCHAR(30),current_period_end TIMESTAMP,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
      "CREATE TABLE wallet_accounts (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,currency VARCHAR(10),credit_type VARCHAR(50),balance INT,reserved_balance INT,updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,UNIQUE(tenant_id,credit_type))",
      "CREATE TABLE wallet_entries (id INT AUTO_INCREMENT PRIMARY KEY,tenant_id INT,account_id INT,entry_type VARCHAR(30),amount INT,balance_after INT,reason VARCHAR(255),reference_id VARCHAR(191))"
    ])await sql.query(statement);
    await sql.query("INSERT INTO tenants (id,name,plan,plan_status) VALUES (1,'Tenant one','free','active'),(2,'Tenant two','free','active')");
    await sql.query("INSERT INTO plans VALUES ('starter','Starter',1499,1,2,5,1,10000),('free','Free',0,1,1,2,1,1000),('business','Business',9999,1,5,25,3,100000)");
    let sequence=0,paymentState="captured",badAmount=false;
    const payment=id=>({id,order_id:id.replace("pay_","order_"),amount:badAmount?1:149900,currency:"INR",status:paymentState,captured:paymentState==="captured"});
    provider=http.createServer(async(req,res)=>{
      let body="";for await(const chunk of req)body+=chunk;
      res.setHeader("Content-Type","application/json");
      if(req.method==="POST"&&req.url==="/orders"){const order=JSON.parse(body);return res.end(JSON.stringify({...order,id:`order_${++sequence}`,status:"created"}));}
      if(req.url.startsWith("/payments/"))return res.end(JSON.stringify(payment(req.url.split("/").pop())));
      if(req.url.startsWith("/orders/")&&req.url.endsWith("/payments"))return res.end(JSON.stringify({items:[payment(req.url.split("/")[2].replace("order_","pay_"))]}));
      res.writeHead(404).end("{}");
    });await new Promise(resolve=>provider.listen(0,"127.0.0.1",resolve));
    process.env.RAZORPAY_API_BASE=`http://127.0.0.1:${provider.address().port}`;
    process.env.RAZORPAY_KEY_ID="rzp_test_fixture";process.env.RAZORPAY_KEY_SECRET="fixture-secret";process.env.RAZORPAY_WEBHOOK_SECRET="fixture-webhook";process.env.NODE_ENV="test";process.env.WA_SKIP_DOTENV="1";
    const dbFile=require.resolve("../config/database");require.cache[dbFile]={id:dbFile,filename:dbFile,loaded:true,exports:{isSqlite:false,query:pool.query.bind(pool),getConnection:pool.getConnection.bind(pool)}};
    const billing=require("../services/billingService");
    const sign=(orderId,paymentId)=>crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const session=await billing.createCheckoutSession(1,null,{planId:"starter"});assert.equal(session.amount,149900);assert.equal(session.live,true);
    const proof={tenantId:1,planId:"starter",orderId:session.orderId,paymentId:"pay_1",signature:sign(session.orderId,"pay_1")};
    await assert.rejects(()=>billing.confirmCheckoutPayment({...proof,tenantId:2}),{code:"ORDER_NOT_FOUND"});
    await assert.rejects(()=>billing.confirmCheckoutPayment({...proof,planId:"business"}),{code:"PLAN_MISMATCH"});
    await assert.rejects(()=>billing.confirmCheckoutPayment({...proof,signature:"fake"}),{code:"INVALID_SIGNATURE"});
    paymentState="authorized";await assert.rejects(()=>billing.confirmCheckoutPayment(proof),{code:"PAYMENT_PENDING"});paymentState="captured";
    badAmount=true;await assert.rejects(()=>billing.confirmCheckoutPayment(proof),{code:"PAYMENT_AMOUNT_MISMATCH"});badAmount=false;
    const results=await Promise.all(Array.from({length:8},(_,i)=>i%2?billing.confirmCheckoutPayment(proof):billing.reconcileGatewayOrder({orderId:session.orderId,payment:payment("pay_1")})));
    assert.equal(results.filter(row=>!row.idempotent).length,1);
    assert.equal((await sql.query("SELECT COUNT(*) n FROM subscriptions"))[0][0].n,1);
    assert.equal((await sql.query("SELECT COUNT(*) n FROM wallet_entries"))[0][0].n,1);
    assert.equal((await sql.query("SELECT balance FROM wallet_accounts"))[0][0].balance,100);
    assert.equal((await sql.query("SELECT status FROM billing_orders WHERE id=?",[session.billingOrderId]))[0][0].status,"paid");
    assert((await billing.reconcileGatewayOrder({orderId:"outside-app",payment:payment("pay_external")})).ignored);
    const renewal=await billing.createCheckoutSession(1,null,{planId:"starter"});
    await sql.query("CREATE TRIGGER billing_rollback BEFORE INSERT ON wallet_entries FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture failure'");
    const renewalProof={...proof,orderId:renewal.orderId,paymentId:"pay_2",signature:sign(renewal.orderId,"pay_2")};
    await assert.rejects(()=>billing.confirmCheckoutPayment(renewalProof),/fixture failure/);
    assert.equal((await sql.query("SELECT COUNT(*) n FROM usage_events"))[0][0].n,1);
    assert.equal((await sql.query("SELECT balance FROM wallet_accounts"))[0][0].balance,100);
    assert.equal((await sql.query("SELECT status FROM billing_orders WHERE id=?",[renewal.billingOrderId]))[0][0].status,"created");
    await sql.query("DROP TRIGGER billing_rollback");await billing.confirmCheckoutPayment(renewalProof);
    const periods=(await sql.query("SELECT current_period_end FROM subscriptions ORDER BY id"))[0];assert(new Date(periods[1].current_period_end)-new Date(periods[0].current_period_end)>=29*86400000);
    const recovered=await billing.createCheckoutSession(1,null,{planId:"starter"});await billing.reconcileGatewayOrder({orderId:recovered.orderId});
    const free=await billing.createCheckoutSession(1,null,{planId:"free"});await billing.confirmCheckoutPayment({tenantId:1,orderId:free.orderId});
    assert.equal((await sql.query("SELECT balance FROM wallet_accounts"))[0][0].balance,300);
    assert.equal((await billing.getBillingOrders(2)).length,0);
    process.env.RAZORPAY_CHECKOUT_ENABLED="0";await assert.rejects(()=>billing.createCheckoutSession(1,null,{planId:"starter"}),{code:"CHECKOUT_PAUSED"});
    await assert.rejects(()=>billing.createCheckoutSession(1,null,{planId:"starter",interval:"year"}),{code:"INVALID_INTERVAL"});
    console.log("PASS: real MySQL checkout and provider HTTP fixture, foreign tenants/plans, invalid signatures, authorized/underpaid rejection, 8 concurrent browser/webhook confirmations credit once, rollback + retry, renewal extension, free plans without bonus farming, scoped history and pause. No live payments.");
  }finally{
    if(provider)await new Promise(resolve=>provider.close(resolve));await sql.end();await admin.query(`DROP DATABASE \`${name}\``);await admin.end();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});

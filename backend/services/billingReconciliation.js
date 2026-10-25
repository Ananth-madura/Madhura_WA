"use strict";
const fail=(message,code,status=409)=>Object.assign(new Error(message),{code,status});
function validateCapturedPayment(order,payment){
  if(!payment||payment.order_id!==order.provider_order_id||!payment.id)throw fail("Payment does not belong to this order","PAYMENT_ORDER_MISMATCH");
  if(payment.status!=="captured"||payment.captured!==true)throw fail("Payment is awaiting capture. Refresh billing after confirmation.","PAYMENT_PENDING");
  if(Number(payment.amount)!==Number(order.amount_minor)||payment.currency!==order.currency)throw fail("Payment amount or currency does not match the order","PAYMENT_AMOUNT_MISMATCH");
  if(Number(payment.amount_refunded||0)>0)throw fail("This payment has a refund and needs billing review","PAYMENT_REFUNDED");
  return payment;
}
function createReconciler(db){
  return async function reconcile({tenantId,paymentId,orderId,source="gateway",billingOrder}){
    if(!billingOrder?.id||Number(billingOrder.tenant_id)!==Number(tenantId)||billingOrder.provider_order_id!==orderId)throw fail("A stored checkout order is required","ORDER_REQUIRED",400);
    if(db.isSqlite)throw fail("Billing settlement requires MySQL","MYSQL_REQUIRED",503);
    const connection=await new Promise((resolve,reject)=>db.getConnection((error,value)=>error?reject(error):resolve(value)));
    const client=connection.promise(),q=async(sql,params=[])=>(await client.query(sql,params))[0];
    try{
      await client.beginTransaction();
      // The tenant lock also serializes different orders changing the same entitlement.
      const [tenant]=await q("SELECT id FROM tenants WHERE id = ? FOR UPDATE",[tenantId]);
      if(!tenant)throw fail("Organization not found","TENANT_NOT_FOUND",404);
      const [order]=await q("SELECT * FROM billing_orders WHERE id = ? AND tenant_id = ? FOR UPDATE",[billingOrder.id,tenantId]);
      if(!order||order.provider_order_id!==orderId)throw fail("Checkout order not found","ORDER_NOT_FOUND",404);
      if(order.status==="paid"){await client.commit();return {success:true,idempotent:true,plan:order.plan_id};}
      if(order.status!=="created")throw fail("Checkout order is no longer payable","ORDER_NOT_PAYABLE");
      const [plan]=await q("SELECT * FROM plans WHERE id = ? LIMIT 1",[order.plan_id]);
      if(!plan)throw fail("Ordered plan no longer exists","PLAN_NOT_FOUND",404);
      if(!paymentId)throw fail("A payment reference is required","PAYMENT_REQUIRED",400);
      const eventKey=`pay_${paymentId}`;
      const existing=await q("SELECT id FROM usage_events WHERE meter_key = 'subscription_payment' AND external_event_id = ? LIMIT 1",[eventKey]);
      if(existing.length)throw fail("Payment has already been used for another order","PAYMENT_ALREADY_USED");
      await q("INSERT INTO usage_events (tenant_id, meter_key, quantity, external_event_id) VALUES (?, 'subscription_payment', ?, ?)",[tenantId,Math.round(Number(order.amount_minor)/100),eventKey]);
      const [previous]=await q("SELECT current_period_end FROM subscriptions WHERE tenant_id = ? AND plan_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1",[tenantId,order.plan_id]);
      const prior=previous?.current_period_end?new Date(previous.current_period_end).getTime():0;
      const free=Number(order.amount_minor)===0;
      const periodEnd=new Date((!free&&Number.isFinite(prior)?Math.max(Date.now(),prior):Date.now())+30*86400000).toISOString().slice(0,19).replace("T"," ");
      await q("UPDATE subscriptions SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND status = 'active'",[tenantId]);
      await q("INSERT INTO subscriptions (tenant_id, plan_id, provider, provider_sub_id, status, current_period_end) VALUES (?, ?, 'razorpay', ?, 'active', ?)",[tenantId,order.plan_id,paymentId,periodEnd]);
      await q("UPDATE tenants SET plan = ?, plan_status = 'active', pending_plan_id = NULL, max_branches = ?, max_seats = ?, max_senders = ?, max_monthly_messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",[order.plan_id,plan.max_branches,plan.max_seats,plan.max_senders,plan.max_monthly_messages,tenantId]);
      // Free-plan switches do not repeatedly mint promotional wallet credits.
      if(!free){
        const grant={growth:500,business:2500,enterprise:10000}[order.plan_id]||100;
        await q("INSERT IGNORE INTO wallet_accounts (tenant_id, currency, credit_type, balance, reserved_balance) VALUES (?, 'INR', 'ai_credits', 0, 0)",[tenantId]);
        await q("UPDATE wallet_accounts SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND credit_type = 'ai_credits'",[grant,tenantId]);
        const [account]=await q("SELECT id, balance FROM wallet_accounts WHERE tenant_id = ? AND credit_type = 'ai_credits' LIMIT 1",[tenantId]);
        await q("INSERT INTO wallet_entries (tenant_id, account_id, entry_type, amount, balance_after, reason, reference_id) VALUES (?, ?, 'credit', ?, ?, ?, ?)",[tenantId,account.id,grant,account.balance,`Plan payment: ${plan.name}`,eventKey]);
      }
      await q("UPDATE billing_orders SET status = 'paid', payment_id = ?, source = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",[paymentId,source,order.id]);
      await client.commit();return {success:true,plan:order.plan_id,status:"active",expires_at:periodEnd};
    }catch(error){await client.rollback();throw error;}finally{connection.release();}
  };
}
module.exports={createReconciler,validateCapturedPayment};

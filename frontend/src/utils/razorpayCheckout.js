let pendingScript;
export function loadRazorpay(){
  if(window.Razorpay)return Promise.resolve(window.Razorpay);
  if(pendingScript)return pendingScript;
  pendingScript=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    const finish=error=>{clearTimeout(timer);script.onload=null;script.onerror=null;if(error){script.remove();reject(error);}else resolve(window.Razorpay);};
    const timer=setTimeout(()=>finish(new Error("Payment checkout took too long to load. Please retry.")),15000);
    script.src="https://checkout.razorpay.com/v1/checkout.js";script.async=true;
    script.onload=()=>finish(window.Razorpay?null:new Error("Payment checkout could not load."));
    script.onerror=()=>finish(new Error("Cannot load Razorpay. Check your connection and retry."));
    document.head.appendChild(script);
  }).catch(error=>{pendingScript=null;throw error;});
  return pendingScript;
}
export async function openRazorpayCheckout(session){
  if(!session?.orderId||!session?.keyId||!Number.isSafeInteger(session.amount)||session.amount<=0)throw new Error("The payment server returned an invalid checkout session.");
  const Razorpay=await loadRazorpay();
  return new Promise((resolve,reject)=>{
    const checkout=new Razorpay({key:session.keyId,order_id:session.orderId,amount:session.amount,currency:session.currency,name:"Madhura Tech",description:`${session.planName} — 30-day plan`,prefill:session.prefill,notes:session.notes,
      handler:result=>resolve({orderId:result.razorpay_order_id,paymentId:result.razorpay_payment_id,signature:result.razorpay_signature}),
      modal:{ondismiss:()=>reject(Object.assign(new Error("Checkout closed. No plan change was confirmed."),{code:"CHECKOUT_DISMISSED"}))}
    });
    checkout.on("payment.failed",event=>{checkout.close();reject(new Error(event.error?.description||"Payment failed. Please retry."));});
    checkout.open();
  });
}

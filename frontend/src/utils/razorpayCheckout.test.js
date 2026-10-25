import {openRazorpayCheckout} from "./razorpayCheckout";
const session={orderId:"order_fixture",keyId:"rzp_test_fixture",amount:149900,currency:"INR",planName:"Starter"};
afterEach(()=>{delete window.Razorpay;});
test("Checkout sends the server order and returns the real provider proof",async()=>{
  let options;
  window.Razorpay=jest.fn(function(value){options=value;this.on=jest.fn();this.open=()=>value.handler({razorpay_order_id:session.orderId,razorpay_payment_id:"pay_fixture",razorpay_signature:"signed-proof"});});
  await expect(openRazorpayCheckout(session)).resolves.toEqual({orderId:"order_fixture",paymentId:"pay_fixture",signature:"signed-proof"});
  expect(options.order_id).toBe(session.orderId);expect(options.amount).toBe(149900);expect(options.key).toBe(session.keyId);
  expect(JSON.stringify(options)).not.toMatch(/key_secret|mock_test_signature|pay_test_/);
});
test("closing Checkout never creates a successful payment proof",async()=>{
  window.Razorpay=jest.fn(function(options){this.on=jest.fn();this.open=()=>options.modal.ondismiss();});
  await expect(openRazorpayCheckout(session)).rejects.toMatchObject({code:"CHECKOUT_DISMISSED"});
});
test("invalid sessions never open the provider widget",async()=>{
  window.Razorpay=jest.fn();await expect(openRazorpayCheckout({...session,amount:-1})).rejects.toThrow("invalid checkout");expect(window.Razorpay).not.toHaveBeenCalled();
});

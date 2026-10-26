import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import InboxComposeExtras from "./InboxComposeExtras";
import api from "../config/axios";
jest.mock("../config/axios",()=>({get:jest.fn(),post:jest.fn()}));
test("an uncertain attachment send retains its request key and never publishes a success",async()=>{
  api.get.mockResolvedValue({data:{templates:[]}});
  api.post.mockRejectedValue({response:{status:504,data:{message:"Delivery is unknown. Do not resend automatically."}}});
  const onSent=jest.fn();render(<InboxComposeExtras conversationId={1} onSent={onSent}/>);
  await waitFor(()=>expect(api.get).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Attachment file"),{target:{files:[new File(["%PDF-fixture"],"private.pdf",{type:"application/pdf"})]}});
  fireEvent.click(screen.getByRole("button",{name:"Send selected content"}));
  expect((await screen.findByRole("alert")).textContent).toContain("Delivery is unknown");
  fireEvent.click(screen.getByRole("button",{name:"Send selected content"}));
  await waitFor(()=>expect(api.post).toHaveBeenCalledTimes(2));
  expect(api.post.mock.calls[0][1].get("requestId")).toBe(api.post.mock.calls[1][1].get("requestId"));
  expect(onSent).not.toHaveBeenCalled();
});

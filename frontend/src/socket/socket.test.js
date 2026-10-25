import { disconnectSocket, socket, notificationSocket } from "./socket";

jest.mock("socket.io-client", () => ({ io: jest.fn(() => ({ connected: true, on: jest.fn(), emit: jest.fn(), disconnect: jest.fn(), connect: jest.fn() })) }));

test("logout disconnects both active sockets and cancels pending connections", () => {
  disconnectSocket();
  expect(socket.disconnect).toHaveBeenCalledTimes(1);
  expect(notificationSocket.disconnect).toHaveBeenCalledTimes(1);
  socket.connected=false;notificationSocket.connected=false;
  disconnectSocket();
  expect(socket.disconnect).toHaveBeenCalledTimes(2);
  expect(notificationSocket.disconnect).toHaveBeenCalledTimes(2);
});

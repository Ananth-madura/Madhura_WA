import { waUiStorage } from './waUiStorage';
test('browser previews and history never cross user accounts', () => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ id: 41 }));
  waUiStorage.setItem('wa_chat_messages_customer', 'private messages');
  localStorage.setItem('user', JSON.stringify({ id: 42 }));
  expect(waUiStorage.getItem('wa_chat_messages_customer')).toBeNull();
  waUiStorage.removeItem('wa_chat_messages_customer');
  localStorage.setItem('user', JSON.stringify({ id: 41 }));
  expect(waUiStorage.getItem('wa_chat_messages_customer')).toBe('private messages');
  expect(waUiStorage.key(0)).toBe('wa_chat_messages_customer');
});

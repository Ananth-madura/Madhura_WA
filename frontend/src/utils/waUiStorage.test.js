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

test('one user switching businesses cannot read another business preview cache', () => {
  localStorage.clear();
  localStorage.setItem('user', JSON.stringify({ id: 41 }));
  localStorage.setItem('active_tenant_id', '1');
  waUiStorage.setItem('wa_chat_messages_customer', 'business one');
  localStorage.setItem('active_tenant_id', '2');
  expect(waUiStorage.getItem('wa_chat_messages_customer')).toBeNull();
  localStorage.setItem('active_tenant_id', '1');
  expect(waUiStorage.getItem('wa_chat_messages_customer')).toBe('business one');
});

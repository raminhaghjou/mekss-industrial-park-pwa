import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post },
}));

const { messageApi } = await import('./message.api');

describe('message API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a batch message with the resolved recipient ids, subject and body', () => {
    messageApi.sendBatchMessage(['user-1', 'user-2'], 'موضوع', 'متن پیام');

    expect(mocks.post).toHaveBeenCalledWith('/messages/batch', { recipientIds: ['user-1', 'user-2'], subject: 'موضوع', body: 'متن پیام' });
  });

  it('reads the inbox and marks a message read against the real management routes', () => {
    messageApi.getInbox();
    messageApi.markRead('message-1');

    expect(mocks.get).toHaveBeenCalledWith('/messages/inbox');
    expect(mocks.post).toHaveBeenCalledWith('/messages/message-1/read');
  });
});

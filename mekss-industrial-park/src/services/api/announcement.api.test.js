import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./base.api', () => ({
  default: { get: mocks.get, post: mocks.post, put: mocks.put, delete: mocks.delete },
}));

const { announcementApi } = await import('./announcement.api');

describe('announcement API contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the public and managed announcement routes', () => {
    announcementApi.getAnnouncements();
    announcementApi.getManagedAnnouncements();

    expect(mocks.get).toHaveBeenCalledWith('/announcements');
    expect(mocks.get).toHaveBeenCalledWith('/announcements/managed');
  });

  it('creates, updates and deletes an announcement against the real management routes', () => {
    const createPayload = { title: 'عنوان', content: 'متن', isGlobal: true };
    const updatePayload = { title: 'عنوان جدید', isPinned: true };

    announcementApi.createAnnouncement(createPayload);
    announcementApi.updateAnnouncement('ann-1', updatePayload);
    announcementApi.deleteAnnouncement('ann-1');

    expect(mocks.post).toHaveBeenCalledWith('/announcements', createPayload);
    expect(mocks.put).toHaveBeenCalledWith('/announcements/ann-1', updatePayload);
    expect(mocks.delete).toHaveBeenCalledWith('/announcements/ann-1');
  });
});

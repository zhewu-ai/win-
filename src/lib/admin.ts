/** 管理员用户列表/单用户的公共字段选择，确保永不返回 passwordHash。 */
export const ADMIN_USER_SELECT = {
  id: true,
  username: true,
  email: true,
  displayName: true,
  avatarColor: true,
  avatarUrl: true,
  avatarSize: true,
  role: true,
  status: true,
  storageQuotaBytes: true,
  storageUsedBytes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const MIN_QUOTA_BYTES = 1024 * 1024; // 1 MB
export const MAX_QUOTA_BYTES = 500 * 1024 * 1024; // 500 MB
export const MIN_PASSWORD_LENGTH = 8;

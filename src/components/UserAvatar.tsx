import type { User } from "@/types";

const AVATAR_COLORS = ["yellow", "blue", "green", "pink", "gray"] as const;

const AVATAR_BG: Record<string, string> = {
  yellow: "bg-accent-yellow text-[#20242a]",
  blue: "bg-accent-blue text-white",
  green: "bg-accent-green text-[#20242a]",
  pink: "bg-accent-pink text-[#20242a]",
  gray: "bg-accent-gray text-[#20242a]",
};

/** 无 avatarColor 时按 username 哈希从预设色取一个稳定颜色。 */
export function hashAvatarColor(username: string): string {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const AVATAR_COLOR_VALUES = AVATAR_COLORS;

const SIZE_CLS: Record<string, string> = {
  sm: "w-7 h-7 text-sm",
  md: "w-8 h-8 text-sm",
};

interface Props {
  user?: Pick<
    User,
    "username" | "displayName" | "avatarColor" | "avatarUrl"
  > | null;
  /** sm = 菜单触发小头像；md = 下拉头部/用户列表大头像 */
  size?: "sm" | "md";
}

/** 用户头像：有 avatarUrl 显示图片，否则按 avatarColor/username 显示文字头像。 */
export default function UserAvatar({ user, size = "md" }: Props) {
  const sizeCls = SIZE_CLS[size] || SIZE_CLS.md;
  const displayName = user?.displayName || user?.username || "…";
  const initial = displayName.trim().charAt(0) || "?";

  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={displayName}
        className={`${sizeCls} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  const avatarCls =
    AVATAR_BG[user?.avatarColor || hashAvatarColor(user?.username || "guest")] ||
    AVATAR_BG.gray;
  return (
    <span
      className={`${sizeCls} rounded-full font-bold flex-shrink-0 flex items-center justify-center ${avatarCls}`}
    >
      {initial}
    </span>
  );
}

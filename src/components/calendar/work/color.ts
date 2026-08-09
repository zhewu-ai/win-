import type { WorkProjectColor } from "@/types";

const WP_CLASS: Record<WorkProjectColor, string> = {
  blue: "wp-blue",
  red: "wp-red",
  green: "wp-green",
  purple: "wp-purple",
  gray: "wp-gray",
};

/** 项目 colorKey → 项目色系类（wp-blue 等，见 globals.css）。 */
export function wpClass(colorKey: WorkProjectColor | string | undefined | null): string {
  if (colorKey && colorKey in WP_CLASS) return WP_CLASS[colorKey as WorkProjectColor];
  return WP_CLASS.gray;
}

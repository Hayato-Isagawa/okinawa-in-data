import type { Theme } from "../../data/schema/dataset-meta";

/** テーマ別の読み物ページ(存在するテーマのみ)。データセットのテーマチップのリンク先 */
export const THEME_PAGES: Partial<Record<Theme, string>> = {
  education: "/themes/education-poverty/",
  poverty: "/themes/education-poverty/",
};

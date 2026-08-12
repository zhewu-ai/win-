"use client";

import type { ChecklistGroup, ChecklistItem, Note } from "@/types";
import ChecklistBlock from "./ChecklistBlock";

interface Props {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
  onChange: (items: ChecklistItem[], groups: ChecklistGroup[]) => void;
  /** `[[` 便签搜索与芯片打开的来源便签列表 / 打开回调（M11.1.2） */
  linkableNotes?: Note[];
  onOpenNote?: (noteId: string) => Promise<boolean> | boolean | void;
}

// 独立模式（旧 checklist 编辑器）：行渲染逻辑已抽到 ChecklistBlock（节点视图共用）。
// groups 已由上层 normalizeChecklist 扁平化（始终 []），此处只透传 items。
export default function ChecklistEditor({
  items,
  groups: _groups,
  onChange,
  linkableNotes,
  onOpenNote,
}: Props) {
  return (
    <ChecklistBlock
      items={items}
      onChange={(next) => onChange(next, [])}
      linkableNotes={linkableNotes}
      onOpenNote={onOpenNote}
    />
  );
}

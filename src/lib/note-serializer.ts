import type { ChecklistGroup, ChecklistItem } from "@/types";

// 输入上限（安全审计 P1-5）：防超大 payload 拖垮解析/序列化/渲染
export const NOTE_TITLE_MAX = 200;
export const NOTE_CONTENT_MAX = 50000;
export const CHECKLIST_ITEMS_MAX = 500;
export const CHECKLIST_ITEM_TEXT_MAX = 1000;
export const CHECKLIST_GROUPS_MAX = 100;
export const CHECKLIST_GROUP_TITLE_MAX = 200;

/** 校验便签标题/正文长度上限。返回错误码或 null。 */
export function validateNoteTextFields(
  body: Record<string, unknown>
): string | null {
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return "INVALID_TITLE";
    if (body.title.length > NOTE_TITLE_MAX) return "TITLE_TOO_LONG";
  }
  if (body.content !== undefined) {
    if (typeof body.content !== "string") return "INVALID_CONTENT";
    if (body.content.length > NOTE_CONTENT_MAX) return "CONTENT_TOO_LONG";
  }
  return null;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Parses a single todo line: strips numbering/bullet/checkbox prefixes, returns clean text + checked state. */
export function parseTodoLine(line: string): { text: string; checked: boolean } {
  let text = line.trim();
  let checked = false;

  const box = text.match(/^\[( |x)\]\s*/i);
  if (box) {
    checked = box[1].toLowerCase() === "x";
    text = text.slice(box[0].length);
  }
  const done = text.match(/^☑\s*/);
  if (done) {
    checked = true;
    text = text.slice(done[0].length);
  } else {
    const todo = text.match(/^☐\s*/);
    if (todo) text = text.slice(todo[0].length);
  }
  // Numbering/bullet markers, with or without trailing space. The (?!\d) guard
  // protects decimals/versions like "1.5 倍速" or "2026.08" from being stripped.
  const marker = text.match(
    /^(?:\d+[.、)](?!\d)|[A-Za-z][.、)](?!\d)|\d{1,3}\s+|[-*•○])\s*/
  );
  if (marker) text = text.slice(marker[0].length);

  return { text: text.trim(), checked };
}

/**
 * Parses a checklist line into a row. A line starting with "# " becomes a
 * lightweight heading row; everything else is a todo (with markers stripped).
 */
export function parseChecklistLine(line: string): {
  kind: "todo" | "heading";
  text: string;
  checked: boolean;
} {
  const trimmed = line.trim();
  if (trimmed.startsWith("# ")) {
    return { kind: "heading", text: trimmed.slice(2).trim(), checked: false };
  }
  const { text, checked } = parseTodoLine(line);
  return { kind: "todo", text, checked };
}

/** Converts plain text content into a flat checklist (headings via "# " lines). */
export function textToChecklist(content: string): {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
} {
  const now = new Date().toISOString();
  const items: ChecklistItem[] = [];
  let order = 0;
  let completedMode = false;

  const makeItem = (
    kind: "todo" | "heading",
    text: string,
    completed: boolean
  ): ChecklistItem => ({
    id: generateId(),
    kind,
    text,
    checked: completed,
    sortOrder: order++,
    createdAt: now,
    updatedAt: now,
    completedAt: completed ? now : null,
  });

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line === "已完成") {
      completedMode = true;
      continue;
    }
    const parsed = parseChecklistLine(line);
    if (parsed.text.length === 0) continue;
    if (parsed.kind === "heading") {
      items.push(makeItem("heading", parsed.text, false));
      continue;
    }
    items.push(makeItem("todo", parsed.text, parsed.checked || completedMode));
  }

  if (items.length === 0) {
    items.push({
      id: generateId(),
      kind: "todo",
      text: "",
      checked: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { items, groups: [] };
}

/** Serializes flat checklist rows back into clean plain text (headings as "# text"). */
export function checklistToText(
  items: ChecklistItem[],
  _groups: ChecklistGroup[]
): string {
  const rows = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = rows.filter((r) => r.kind === "heading" || !r.checked);
  const completed = rows
    .filter((r) => r.kind !== "heading" && r.checked)
    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  const lines: string[] = [];
  for (const r of active) {
    const t = r.text.trim();
    if (!t) continue;
    lines.push(r.kind === "heading" ? `# ${t}` : t);
  }
  const completedTexts = completed
    .map((i) => i.text.trim())
    .filter((t) => t.length > 0);
  if (completedTexts.length > 0) {
    lines.push("", "已完成", ...completedTexts);
  }
  return lines.join("\n");
}

export function parseChecklistItems(value: unknown): unknown[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed : [];
}

export function parseChecklistGroups(value: unknown): unknown[] {
  if (!value) return [];
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed : [];
}

/** Validates that checklistItems is an array with proper item structure. Returns error message or null. */
export function validateChecklistItems(
  items: unknown
): string | null {
  if (!Array.isArray(items)) {
    return "checklistItems must be an array";
  }
  if (items.length > CHECKLIST_ITEMS_MAX) {
    return `checklistItems exceeds max of ${CHECKLIST_ITEMS_MAX} items`;
  }
  for (const item of items) {
    if (typeof item !== "object" || item === null) {
      return "each checklist item must be an object";
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== "string" || obj.id === "") {
      return "each checklist item must have a non-empty string id";
    }
    if (typeof obj.text !== "string") {
      return "each checklist item must have a string text";
    }
    if (obj.text.length > CHECKLIST_ITEM_TEXT_MAX) {
      return `checklist item text exceeds max of ${CHECKLIST_ITEM_TEXT_MAX} chars`;
    }
    if (typeof obj.checked !== "boolean") {
      return "each checklist item must have a boolean checked";
    }
  }
  return null;
}

/** Validates that checklistGroups is an array with proper group structure. Returns error message or null. */
export function validateChecklistGroups(
  groups: unknown
): string | null {
  if (!Array.isArray(groups)) {
    return "checklistGroups must be an array";
  }
  if (groups.length > CHECKLIST_GROUPS_MAX) {
    return `checklistGroups exceeds max of ${CHECKLIST_GROUPS_MAX} groups`;
  }
  for (const group of groups) {
    if (typeof group !== "object" || group === null) {
      return "each checklist group must be an object";
    }
    const obj = group as Record<string, unknown>;
    if (typeof obj.id !== "string" || obj.id === "") {
      return "each checklist group must have a non-empty string id";
    }
    if (typeof obj.title !== "string") {
      return "each checklist group must have a string title";
    }
    if (obj.title.length > CHECKLIST_GROUP_TITLE_MAX) {
      return `checklist group title exceeds max of ${CHECKLIST_GROUP_TITLE_MAX} chars`;
    }
  }
  return null;
}

export function serializeNote(note: Record<string, unknown>) {
  const rawAttachments = note.attachments;
  let attachments: Record<string, unknown>[] = [];
  if (Array.isArray(rawAttachments)) {
    attachments = rawAttachments.map((att: unknown) => {
      const record = att as Record<string, unknown>;
      // Filter out internal fields; keep only what the frontend needs
      const { storagePath, ...rest } = record;
      return rest;
    });
  }

  // M16R3：从展开中剔除 tagBindings（防内联 tag 对象），输出 tags/manualTags 名合集。
  const { tagBindings, ...rest } = note;
  const rawBindings = tagBindings;
  let tags: string[] = [];
  let manualTags: string[] = [];
  if (Array.isArray(rawBindings)) {
    const autoSet = new Set<string>();
    const manualSet = new Set<string>();
    for (const b of rawBindings) {
      const rec = b as Record<string, unknown>;
      const tag = rec.tag as Record<string, unknown> | undefined;
      const name = typeof tag?.name === "string" ? tag.name : "";
      if (!name) continue;
      if (rec.source === "manual") manualSet.add(name);
      else autoSet.add(name);
    }
    tags = [...new Set([...autoSet, ...manualSet])];
    manualTags = [...manualSet];
  }

  return {
    ...rest,
    mode: note.mode || "text",
    checklistItems: parseChecklistItems(note.checklistItems),
    checklistGroups: parseChecklistGroups(note.checklistGroups),
    attachments,
    tags,
    manualTags,
  };
}

/**
 * Normalizes checklist data into flat rows:
 * - legacy grouped data (groupId + checklistGroups) is migrated to a flat list
 *   where each group title becomes a heading row (a single default "待办" group
 *   does not produce a heading, to keep existing single-section notes unchanged);
 * - items already in flat form are only backfilled (kind / completedAt).
 * Returns { items, groups, changed } — when changed, the caller should persist
 * the flattened result (groups become empty).
 */
export function normalizeChecklist(
  items: ChecklistItem[],
  groups: ChecklistGroup[]
): {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
  changed: boolean;
} {
  const now = new Date().toISOString();
  let changed = false;

  const backfill = (item: ChecklistItem): ChecklistItem => {
    let next: ChecklistItem = item;
    if (item.kind !== "heading") {
      if (item.kind !== "todo") {
        next = { ...next, kind: "todo" };
        changed = true;
      }
      if (item.checked && !item.completedAt) {
        next = {
          ...next,
          completedAt: item.updatedAt || item.createdAt || now,
        };
        changed = true;
      }
    }
    return next;
  };

  // Already flat (heading rows present) — nothing to migrate.
  if (items.some((i) => i.kind === "heading")) {
    return { items: items.map(backfill), groups: [], changed };
  }

  // Fresh flat todo-only note (e.g. the empty item created in the editor).
  if (groups.length === 0 && !items.some((i) => i.groupId)) {
    return { items: items.map(backfill), groups: [], changed };
  }

  // Migrate legacy grouped model -> flat rows.
  changed = true;
  const flat: ChecklistItem[] = [];
  let order = 0;

  const sortedGroups =
    groups.length > 0
      ? [...groups].sort((a, b) => a.sortOrder - b.sortOrder)
      : [{ id: "default", title: "待办", sortOrder: 0 }];
  const validGroupIds = new Set(sortedGroups.map((g) => g.id));
  const singleDefault =
    groups.length <= 1 && sortedGroups[0].title === "待办";

  const emitItem = (it: ChecklistItem) => {
    flat.push({
      ...it,
      kind: "todo",
      groupId: undefined,
      sortOrder: order++,
      completedAt:
        it.checked && !it.completedAt
          ? it.updatedAt || it.createdAt || now
          : it.completedAt,
    });
  };

  for (const g of sortedGroups) {
    if (!singleDefault && g.title.trim()) {
      flat.push({
        id: generateId(),
        kind: "heading",
        text: g.title.trim(),
        checked: false,
        sortOrder: order++,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    }
    const gItems = items.filter((i) => i.groupId === g.id);
    const incomplete = gItems
      .filter((i) => !i.checked)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const completed = gItems
      .filter((i) => i.checked)
      .sort((a, b) =>
        (b.completedAt || "").localeCompare(a.completedAt || "")
      );
    for (const it of [...incomplete, ...completed]) emitItem(it);
  }

  // Items whose groupId is missing/invalid land after all groups, no heading.
  const orphaned = items
    .filter((i) => !i.groupId || !validGroupIds.has(i.groupId))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  for (const it of orphaned) emitItem(it);

  return { items: flat, groups: [], changed: true };
}

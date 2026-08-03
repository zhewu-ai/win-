import type { ChecklistGroup, ChecklistItem } from "@/types";

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

/** Converts plain text content into a flat checklist (single default group). */
export function textToChecklist(content: string): {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
} {
  const now = new Date().toISOString();
  const groups: ChecklistGroup[] = [
    { id: "default", title: "待办", sortOrder: 0, collapsedCompleted: true },
  ];
  const items: ChecklistItem[] = [];
  let order = 0;
  let completedMode = false;

  const makeItem = (
    text: string,
    completed: boolean
  ): ChecklistItem => ({
    id: generateId(),
    text,
    checked: completed,
    sortOrder: order++,
    createdAt: now,
    updatedAt: now,
    groupId: groups[0].id,
    completedAt: completed ? now : null,
  });

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    if (line === "已完成") {
      completedMode = true;
      continue;
    }
    const parsed = parseTodoLine(line);
    if (parsed.text.length === 0) continue;
    items.push(makeItem(parsed.text, parsed.checked || completedMode));
  }

  if (items.length === 0) {
    items.push({
      id: generateId(),
      text: "",
      checked: false,
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      groupId: groups[0].id,
    });
  }

  return { items, groups };
}

/** Serializes checklist items/groups back into clean plain text (no [ ]/[x] prefixes). */
export function checklistToText(
  items: ChecklistItem[],
  groups: ChecklistGroup[]
): string {
  const sortedGroups = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const visible = sortedGroups.filter((g) =>
    items.some((i) => i.groupId === g.id)
  );
  const blocks: string[] = [];
  for (const g of visible) {
    const incomplete = items
      .filter((i) => i.groupId === g.id && !i.checked)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.text.trim())
      .filter((t) => t.length > 0);
    const completed = items
      .filter((i) => i.groupId === g.id && i.checked)
      .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))
      .map((i) => i.text.trim())
      .filter((t) => t.length > 0);
    const block: string[] = [];
    if (visible.length > 1) block.push(g.title.trim() || "待办");
    block.push(...incomplete);
    if (completed.length > 0) {
      block.push("");
      block.push("已完成");
      block.push(...completed);
    }
    blocks.push(block.join("\n"));
  }
  return blocks.join("\n\n");
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
  }
  return null;
}

export function serializeNote(note: Record<string, unknown>) {  const rawAttachments = note.attachments;
  let attachments: Record<string, unknown>[] = [];
  if (Array.isArray(rawAttachments)) {
    attachments = rawAttachments.map((att: unknown) => {
      const record = att as Record<string, unknown>;
      // Filter out internal fields; keep only what the frontend needs
      const { storagePath, ...rest } = record;
      return rest;
    });
  }

  return {
    ...note,
    mode: note.mode || "text",
    checklistItems: parseChecklistItems(note.checklistItems),
    checklistGroups: parseChecklistGroups(note.checklistGroups),
    attachments,
  };
}

/**
 * Normalizes legacy checklist data into grouped form:
 * - empty groups -> a single default group titled "待办"
 * - items without a valid groupId -> assigned to the first group
 * - checked items without completedAt -> backfill from updatedAt/createdAt
 * Returns { items, groups, changed } where changed indicates the result
 * should be persisted.
 */
export function normalizeChecklist(
  items: ChecklistItem[],
  groups: ChecklistGroup[]
): {
  items: ChecklistItem[];
  groups: ChecklistGroup[];
  changed: boolean;
} {
  let changed = false;
  let resultGroups: ChecklistGroup[] = groups;
  if (groups.length === 0) {
    resultGroups = [
      { id: "default", title: "待办", sortOrder: 0, collapsedCompleted: true },
    ];
    changed = true;
  }
  const validGroupIds = new Set(resultGroups.map((g) => g.id));
  const defaultGroupId = resultGroups[0].id;
  const resultItems = items.map((item) => {
    let next: ChecklistItem = item;
    if (!item.groupId || !validGroupIds.has(item.groupId)) {
      next = { ...item, groupId: defaultGroupId };
      changed = true;
    }
    if (item.checked && !item.completedAt) {
      next = {
        ...next,
        completedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      };
      changed = true;
    }
    return next;
  });
  return { items: resultItems, groups: resultGroups, changed };
}

import { DateTime } from "luxon";

export type SlotInput = {
  mode: "daily" | "selected_days";
  days: number[];
  times: string[];
  startDate: string;
  timezone: string;
  count: number;
  now: Date;
  minLeadMs: number;
  exclude?: Date[];
};

export function computeSlots(input: SlotInput): Date[] {
  const times = [...new Set(input.times)].sort();
  const allowed = new Set(input.mode === "daily" ? [0, 1, 2, 3, 4, 5, 6] : input.days);
  const earliest = input.now.getTime() + input.minLeadMs;
  const excluded = new Set((input.exclude ?? []).map((d) => d.getTime()));
  const out: Date[] = [];
  if (!times.length || !allowed.size || input.count <= 0) return out;
  let day = DateTime.fromISO(input.startDate, { zone: input.timezone }).startOf("day");
  if (!day.isValid) return out;
  for (let guard = 0; out.length < input.count && guard < 3660; guard++) {
    if (allowed.has(day.weekday % 7)) {
      for (const t of times) {
        const [h, m] = t.split(":").map(Number);
        const slot = day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
        const ms = slot.toMillis();
        if (ms < earliest || excluded.has(ms)) continue;
        out.push(slot.toJSDate());
        if (out.length >= input.count) break;
      }
    }
    day = day.plus({ days: 1 });
  }
  return out;
}

export type PreviewItem = { mediaId: string; caption: string; scheduledAt?: Date };

export function assignSlots(items: PreviewItem[], base: Omit<SlotInput, "count" | "exclude">) {
  const fixed = items.filter((i) => i.scheduledAt).map((i) => i.scheduledAt!);
  const freeCount = items.filter((i) => !i.scheduledAt).length;
  const slots = computeSlots({ ...base, count: freeCount, exclude: fixed });
  let k = 0;
  return items.map((i) => ({
    mediaId: i.mediaId,
    caption: i.caption,
    fixed: Boolean(i.scheduledAt),
    scheduledAt: i.scheduledAt ?? slots[k++],
  }));
}

export function todayIn(timezone: string, now = new Date()) {
  return DateTime.fromJSDate(now, { zone: timezone }).toISODate()!;
}

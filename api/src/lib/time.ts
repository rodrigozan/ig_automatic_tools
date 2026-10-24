export function formatInZone(d: Date, timeZone: string) {
  const date = d.toLocaleDateString("pt-BR", { timeZone, day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

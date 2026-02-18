export type PeriodPreset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

export type Period = {
  start: Date;
  end: Date;
  label: string;
};

export const periodPresets: { key: PeriodPreset; label: string }[] = [
  { key: "this_week", label: "今週" },
  { key: "last_week", label: "先週" },
  { key: "this_month", label: "今月" },
  { key: "last_month", label: "先月" },
  { key: "custom", label: "カスタム" },
];

export function getPeriod(preset: PeriodPreset, customStart?: Date, customEnd?: Date): Period {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "this_week": {
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { start: monday, end: sunday, label: "今週" };
    }
    case "last_week": {
      const dayOfWeek = today.getDay();
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      lastSunday.setHours(23, 59, 59, 999);
      return { start: lastMonday, end: lastSunday, label: "先週" };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "今月" };
    }
    case "last_month": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "先月" };
    }
    case "custom": {
      return {
        start: customStart ?? today,
        end: customEnd ?? today,
        label: "カスタム",
      };
    }
  }
}

/**
 * Get the comparison period (same length, immediately preceding).
 */
export function getComparisonPeriod(period: Period): Period {
  const durationMs = period.end.getTime() - period.start.getTime();
  const prevEnd = new Date(period.start.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  prevStart.setHours(0, 0, 0, 0);
  return { start: prevStart, end: prevEnd, label: "前期" };
}

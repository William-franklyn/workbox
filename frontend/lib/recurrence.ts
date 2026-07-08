export type Recurrence = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "yearly";

/** Next occurrence date (YYYY-MM-DD) after `from` for a recurrence rule. */
export function nextOccurrence(rule: Recurrence, from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  switch (rule) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case "weekdays": {
      date.setUTCDate(date.getUTCDate() + 1);
      const day = date.getUTCDay();
      if (day === 6) date.setUTCDate(date.getUTCDate() + 2);      // Sat → Mon
      else if (day === 0) date.setUTCDate(date.getUTCDate() + 1); // Sun → Mon
      break;
    }
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "biweekly":
      date.setUTCDate(date.getUTCDate() + 14);
      break;
    case "monthly": {
      const targetDay = date.getUTCDate();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + 1);
      const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(targetDay, daysInMonth));
      break;
    }
    case "yearly":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }

  return date.toISOString().slice(0, 10);
}

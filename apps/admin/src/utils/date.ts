export function formatAdminDate(v?: string | null): string {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);

    const now = new Date();
    if (d.getFullYear() === now.getFullYear()) {
      // Build date and time separately to avoid locale inserting "at"
      const datePart = d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
      });
      const timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${datePart}, ${timePart}`; // e.g., Aug 08, 11:12 PM
    }
    // Example for older years: Aug 08, 2024
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(v ?? "");
  }
}

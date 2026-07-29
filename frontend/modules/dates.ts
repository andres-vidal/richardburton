/**
 * A timestamp as the database shows dates: the day, not the hour. Everything
 * the app dates — history entries, the trash, who joined when — reads the same
 * way.
 */
function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export { formatDate };

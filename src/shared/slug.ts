/**
 * Generate a URL-safe slug from a title string.
 * Handles empty input by returning "new-mission".
 */
export function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "new-mission"
  );
}

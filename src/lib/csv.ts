/** CSV quoting alone does not prevent spreadsheet formula execution. */
export function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  // eslint-disable-next-line no-control-regex -- Untrusted CSV may contain leading control characters.
  if (typeof value !== 'number' && /^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = "'" + text
  return `"${text.replace(/"/g, '""')}"`
}

/** English-style count label: "1 listing" vs "12 listings". */
export function countNoun(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

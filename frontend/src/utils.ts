/**
 * Converts a compact date string (e.g., "20230827T153000") to a
 * JavaScript Date object. The input should have the following format:
 *
 * ```
 * YYYYMMDDTHHmmSS
 * ```
 *
 * @param dateString - The date string to convert.
 *
 * @returns The corresponding Date object.
 */
export function str2date(dateString: string): Date {
    const YYYY = dateString.slice(0, 4);
    const MM = dateString.slice(4, 6);
    const DD = dateString.slice(6, 8);
    const HH = dateString.slice(9, 11);
    const mm = dateString.slice(11, 13);
    const SS = dateString.slice(13, 15);
    const isoString = `${YYYY}-${MM}-${DD}T${HH}:${mm}:${SS}Z`;
    return new Date(isoString);
}

/**
 * Formats a Date object into a human-readable string using the user's locale.
 *
 * Example output: "Aug 27, 2025, 03:30 PM"
 *
 * @param date - The Date object to format.
 * @returns The formatted date string.
 */
export function formatDate(date: Date): string {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleString(undefined, options);
}

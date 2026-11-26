// Client-safe review constants. Keep this file free of server-only imports
// (e.g. ~/db) so route components can use it without bundling better-sqlite3.

export const MIN_REVIEW_LENGTH = 10;
export const MAX_REVIEW_LENGTH = 1000;

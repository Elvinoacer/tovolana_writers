/**
 * Pure TypeScript client-safe upload constants.
 * This file MUST NOT import any server modules, fs, AWS SDK, or secrets,
 * allowing safe usage in "use client" components as well as server runtimes.
 */

export const MAX_BROWSER_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

// Storage helpers — now uses MongoDB via backend API (base64)
// These are kept for compatibility but delegate to the API client

import { apiUpdatePhoto } from "@/lib/api";

/** Upload profile photo via backend API — returns base64 data URL */
export async function uploadProfilePhoto(
  _userId: string,
  file: File,
  _ext = "jpg"
): Promise<string> {
  const res = await apiUpdatePhoto(file);
  return res.profile_photo_b64;
}

/** Convert selfie blob to base64 data URL (stored in MongoDB via checkin/checkout) */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Upload selfie — returns base64 data URL (passed directly in attendance API) */
export async function uploadSelfie(_userId: string, blob: Blob): Promise<string> {
  return blobToDataUrl(blob);
}

/** Get signed URL — with MongoDB we store base64 data URLs directly, just return as-is */
export async function getSignedUrl(
  _bucket: string,
  pathOrDataUrl: string,
  _expiresIn = 3600
): Promise<string | null> {
  if (!pathOrDataUrl) return null;
  return pathOrDataUrl; // Already a base64 data URL or URL
}

/** Upload daily update image — returns base64 data URL */
export async function uploadDailyUpdateImage(
  _userId: string,
  file: File | Blob,
  _index: number,
  _ext = "jpg"
): Promise<string> {
  return blobToDataUrl(file);
}

/** Upload activity image — returns base64 data URL */
export async function uploadActivityImage(
  _userId: string,
  file: File | Blob,
  _ext = "jpg"
): Promise<string> {
  return blobToDataUrl(file);
}

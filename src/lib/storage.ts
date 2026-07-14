import { supabase } from "@/integrations/supabase/client";

export async function uploadProfilePhoto(userId: string, file: File | Blob, ext = "jpg"): Promise<string> {
  const path = `${userId}/profile-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("profile-photos").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

export async function uploadSelfie(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/selfie-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("attendance-selfies").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function uploadDailyUpdateImage(userId: string, file: File | Blob, index: number, ext = "jpg"): Promise<string> {
  const path = `${userId}/update-${Date.now()}-${index}.${ext}`;
  const { error } = await supabase.storage.from("daily-updates").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

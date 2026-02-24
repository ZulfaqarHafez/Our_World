import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

/**
 * Upload a photo to the private couple-photos bucket and return the storage path.
 */
export async function uploadPhoto(
  file: File,
  userId: string,
  dateId: string
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storagePath = `${userId}/${dateId}/${fileName}`;

  const { error } = await supabase.storage
    .from("couple-photos")
    .upload(storagePath, file, { contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  return storagePath;
}

/**
 * Upload multiple photos and return all storage paths.
 */
export async function uploadPhotos(
  files: File[],
  userId: string,
  dateId: string
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const path = await uploadPhoto(file, userId, dateId);
    paths.push(path);
  }
  return paths;
}

/**
 * Get signed URLs for an array of storage paths (via server route for security).
 */
export async function getSignedPhotoUrls(
  paths: string[]
): Promise<{ path: string; signedUrl: string }[]> {
  if (paths.length === 0) return [];

  const result = await apiFetch<{ urls: { path: string; signedUrl: string }[] }>(
    "/api/photos/sign",
    {
      method: "POST",
      body: JSON.stringify({ paths }),
    }
  );

  return result.urls;
}

/**
 * Delete a photo from storage.
 */
export async function deletePhoto(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from("couple-photos")
    .remove([storagePath]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

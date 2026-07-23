import { ref, uploadBytesResumable, getDownloadURL, type FirebaseStorage } from "firebase/storage";

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

export function validateProfilePhoto(file: File): string | null {
  if (!PROFILE_PHOTO_TYPES.includes(file.type as (typeof PROFILE_PHOTO_TYPES)[number])) {
    return "Only JPEG and PNG files are allowed";
  }
  if (file.size > PROFILE_PHOTO_MAX_BYTES) {
    return "Image must be less than 2 MB";
  }
  return null;
}

export async function uploadProfilePhoto(params: {
  storage: FirebaseStorage;
  uid: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<string> {
  const storageRef = ref(
    params.storage,
    `avatars/${params.uid}/${Date.now()}_${params.file.name}`
  );

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, params.file);
    task.on(
      "state_changed",
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        params.onProgress?.(percent);
      },
      reject,
      () => resolve()
    );
  });

  return getDownloadURL(storageRef);
}

import * as faceapi from 'face-api.js';

const MODELS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let modelsLoaded = false;

export async function loadFaceModels() {
  if (modelsLoaded) return;
  
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
    ]);
    modelsLoaded = true;
    console.log("Face models loaded successfully");
  } catch (error) {
    console.error("Failed to load face models:", error);
    throw new Error("Failed to load face recognition models. Please check your internet connection.");
  }
}

export async function getFaceDescriptor(imageElement: HTMLImageElement | HTMLVideoElement) {
  if (!modelsLoaded) await loadFaceModels();
  
  const detection = await faceapi
    .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
    
  return detection ? detection.descriptor : null;
}

/**
 * Returns true if the faces match, false otherwise.
 * The distance threshold is usually 0.6. A lower number (e.g. 0.45) is more strict.
 */
export async function compareFaces(
  liveImage: HTMLImageElement | HTMLVideoElement,
  profileImageUrl: string,
  threshold = 0.5
): Promise<{ match: boolean; distance: number; error?: string }> {
  try {
    // Extract descriptor from live camera image
    const liveDescriptor = await getFaceDescriptor(liveImage);
    if (!liveDescriptor) {
      return { match: false, distance: 1, error: "No face detected in live selfie. Please make sure your face is clearly visible." };
    }

    // Load profile photo into an Image element
    const profileImg = new Image();
    profileImg.crossOrigin = "anonymous";
    profileImg.src = profileImageUrl;
    
    await new Promise((resolve, reject) => {
      profileImg.onload = resolve;
      profileImg.onerror = () => reject(new Error("Failed to load profile photo for comparison."));
    });

    // Extract descriptor from profile photo
    const profileDescriptor = await getFaceDescriptor(profileImg);
    if (!profileDescriptor) {
      return { match: false, distance: 1, error: "No face detected in your profile photo. Please upload a clear photo in your profile." };
    }

    // Compare
    const distance = faceapi.euclideanDistance(liveDescriptor, profileDescriptor);
    return {
      match: distance < threshold,
      distance,
    };
  } catch (err) {
    console.error("Face comparison error:", err);
    return { match: false, distance: 1, error: err instanceof Error ? err.message : "Face comparison failed." };
  }
}

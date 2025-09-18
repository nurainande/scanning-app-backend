import cv from "@techstark/opencv-js";

/**
 * Compute similarity score between two images using SSIM.
 */
export async function compareImages(imagePath1: string, imagePath2: string): Promise<number> {
  // Read images directly from file paths
  const img1 = cv.imread(imagePath1);
  const img2 = cv.imread(imagePath2);

  // Convert to grayscale
  const gray1 = new cv.Mat();
  const gray2 = new cv.Mat();
  cv.cvtColor(img1, gray1, cv.COLOR_BGR2GRAY);
  cv.cvtColor(img2, gray2, cv.COLOR_BGR2GRAY);

  // Resize to match
  const size = new cv.Size(400, 400);
  const resized1 = new cv.Mat();
  const resized2 = new cv.Mat();
  cv.resize(gray1, resized1, size);
  cv.resize(gray2, resized2, size);

  // Compute absolute difference
  const diff = new cv.Mat();
  cv.absdiff(resized1, resized2, diff);

  // Count non-zero pixels
  const nonZeroCount = cv.countNonZero(diff);
  const score = 1 - nonZeroCount / (400 * 400);

  // Clean up memory
  img1.delete();
  img2.delete();
  gray1.delete();
  gray2.delete();
  resized1.delete();
  resized2.delete();
  diff.delete();

  return score; // 0–1 similarity
}

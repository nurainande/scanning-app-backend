process.env.OPENCV4NODEJS_DISABLE_EXTERNAL_MEM_TRACKING = "1";
import cv from "opencv4nodejs";
// import * as cv from "opencv4nodejs";


/**
 * Compute similarity score between two images using SSIM.
 */
export function compareImages(imagePath1:string, imagePath2:string) {
  const img1 = cv.imread(imagePath1).bgrToGray();
  const img2 = cv.imread(imagePath2).bgrToGray();

  // Resize to match
  const size = new cv.Size(400, 400);
  const r1 = img1.resize(size);
  const r2 = img2.resize(size);

  const diff = r1.absdiff(r2);
  const score = 1 - diff.countNonZero() / (400 * 400);

  return score; // 0–1 similarity
}

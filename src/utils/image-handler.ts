import { AxiosResponse } from 'axios';
import path from 'path';
import sharp from 'sharp';

export interface ImageFile {
  path: string;
  mimeType: string;
  base64Data: string;
}

export const IMAGE_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', 
  '.webp', '.ico', '.tiff', '.tif', '.avif'
];

export function isImageFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
    '.avif': 'image/avif'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function processImageResponse(response: AxiosResponse, filePath: string, maxDimension: number = 2048): Promise<ImageFile> {
  const buffer = Buffer.from(response.data);
  
  try {
    // Get image metadata
    const metadata = await sharp(buffer).metadata();
    
    // Check if resizing is needed
    if (metadata.width && metadata.height && 
        (metadata.width > maxDimension || metadata.height > maxDimension)) {
      
      // Calculate new dimensions while maintaining aspect ratio
      let width = metadata.width;
      let height = metadata.height;
      
      if (width > height) {
        // Landscape orientation
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        // Portrait or square orientation
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      
      // Resize the image
      const resizedBuffer = await sharp(buffer)
        .resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer();
      
      return {
        path: filePath,
        mimeType: getMimeType(filePath),
        base64Data: resizedBuffer.toString('base64')
      };
    }
  } catch (error) {
    // If sharp fails (e.g., for non-image files), fall back to original
    console.error('Failed to process image with sharp:', error);
  }
  
  // Return original if no resizing needed or if processing failed
  return {
    path: filePath,
    mimeType: getMimeType(filePath),
    base64Data: buffer.toString('base64')
  };
}
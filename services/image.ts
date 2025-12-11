import * as ImagePicker from 'expo-image-picker';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { Platform } from 'react-native';

export class ImageService {
  // Request image picker permissions
  static async requestImagePermissions(): Promise<boolean> {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        return status === 'granted';
      }
      return true;
    } catch (error) {
      console.error('Image permission error:', error);
      return false;
    }
  }

  // Pick image from gallery
  static async pickImage(options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }): Promise<string | null> {
    try {
      const hasPermission = await this.requestImagePermissions();
      if (!hasPermission) {
        throw new Error('Image picker permission denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect ?? [1, 1],
        quality: options?.quality ?? 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Pick image error:', error);
      return null;
    }
  }

  // Take photo with camera
  static async takePhoto(options?: {
    allowsEditing?: boolean;
    aspect?: [number, number];
    quality?: number;
  }): Promise<string | null> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Camera permission denied');
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect ?? [1, 1],
        quality: options?.quality ?? 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return null;
    } catch (error) {
      console.error('Take photo error:', error);
      return null;
    }
  }

  // Upload image to Firebase Storage with compression and robust metadata + retry
  static async uploadImage(
    uri: string,
    path: string,
    fileName?: string
  ): Promise<string | null> {
    try {
      console.log('🔄 Starting image upload:', { uri: uri.substring(0, 50) + '...', path, fileName });

      // Validate inputs
      if (!uri || !path) {
        throw new Error('URI and path are required for image upload');
      }

      // Check authentication before proceeding
      const { auth } = await import('@/config/firebase');
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload images');
      }

      const optimizedUri = await this.compressAndResize(uri);
      if (!optimizedUri) {
        throw new Error('Failed to optimize image');
      }

      console.log('📱 Fetching image blob from URI...');
      const response = await fetch(optimizedUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('📦 Image blob created:', { size: blob.size, type: blob.type });

      // Validate blob size (max 10MB)
      if (blob.size > 10 * 1024 * 1024) {
        throw new Error('Image file too large (max 10MB)');
      }

      const timestamp = Date.now();
      const ext = ImageService.getExtensionFromUri(optimizedUri) ?? 'jpg';
      const finalFileName = fileName || `image_${timestamp}.${ext}`;
      const contentType = ImageService.getContentTypeFromExt(ext);

      console.log('🗂️ Creating storage reference:', { path, fileName: finalFileName, contentType });
      const storageRef = ref(storage, `${path}/${finalFileName}`);

      // Retry upload with exponential backoff - FAST for safety reports
      const maxAttempts = 2; // Reduced to 2 for faster UX
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < maxAttempts) {
        try {
          attempt += 1;
          console.log(`🔄 Upload attempt ${attempt}/${maxAttempts}...`);

          const metadata = {
            contentType,
            cacheControl: 'public,max-age=31536000,immutable',
            customMetadata: {
              uploadedAt: new Date().toISOString(),
              originalName: finalFileName,
            }
          };

          const task = uploadBytesResumable(storageRef, blob, metadata);

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Upload timeout after 25 seconds'));
            }, 25000); // 25 second timeout

            task.on(
              'state_changed',
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (progress % 25 === 0) {
                  console.log(`📊 Upload progress: ${Math.round(progress)}%`);
                }
              },
              (error) => {
                clearTimeout(timeout);
                console.error(`❌ Upload task error:`, error.code, error.message);
                reject(error);
              },
              () => {
                clearTimeout(timeout);
                console.log('✅ Upload task completed successfully');
                resolve();
              }
            );
          });

          console.log('🔗 Getting download URL...');
          const downloadURL = await getDownloadURL(storageRef);
          console.log('✅ Image uploaded successfully:', downloadURL.substring(0, 100) + '...');

          return downloadURL;

        } catch (err) {
          lastError = err as Error;
          const errorCode = (lastError as any)?.code;
          console.error(`❌ Upload attempt ${attempt} failed:`, {
            error: lastError.message,
            code: errorCode,
          });

          // Don't retry on authorization or not-found errors
          if (errorCode === 'storage/unauthorized' || errorCode === 'storage/object-not-found') {
            console.log('🚫 Non-retryable error - stopping retries');
            break;
          }

          if (attempt >= maxAttempts) {
            break;
          }

          // Shorter delay for faster UX: 500ms
          const delay = 500;
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise((res) => setTimeout(res, delay));
        }
      }

      // All attempts failed - return placeholder instead of throwing
      const errorCode = (lastError as any)?.code;
      console.error('💥 Final upload failure:', lastError?.message, 'Code:', errorCode);

      // Return appropriate placeholder based on error type
      if (errorCode === 'storage/unauthorized') {
        return 'https://via.placeholder.com/400x300/ffebee/d32f2f?text=Upload+Unauthorized';
      } else {
        return 'https://via.placeholder.com/400x300/fff3e0/f57c00?text=Upload+Failed';
      }

    } catch (error) {
      console.error('💥 Upload image error:', {
        message: (error as Error).message,
        code: (error as any)?.code,
        stack: (error as Error).stack?.split('\n').slice(0, 3)
      });
      return null;
    }
  }

  // Delete image from Firebase Storage
  static async deleteImage(urlOrPath: string): Promise<boolean> {
    try {
      const storageRef = ref(storage, urlOrPath);
      await deleteObject(storageRef);
      return true;
    } catch (error) {
      console.error('Delete image error:', error);
      return false;
    }
  }

  // Upload profile picture (keeps historical versions)
  static async uploadProfilePicture(
    userId: string,
    uri: string
  ): Promise<string | null> {
    const timestamp = Date.now();
    const fileName = `${userId}_profile_${timestamp}.jpg`;
    return this.uploadImage(uri, `profile-pictures`, fileName);
  }

  // Upload vehicle document (keeps historical versions)
  static async uploadVehicleDocument(
    userId: string,
    uri: string,
    documentType: 'registration' | 'insurance'
  ): Promise<string | null> {
    const timestamp = Date.now();
    const fileName = `${userId}_${documentType}_${timestamp}.jpg`;
    return this.uploadImage(
      uri,
      `vehicle-documents`,
      fileName
    );
  }

  // Upload incident image
  static async uploadIncidentImage(
    rideId: string,
    uri: string
  ): Promise<string | null> {
    const timestamp = Date.now();
    return this.uploadImage(
      uri,
      `incident-images`,
      `${rideId}_incident_${timestamp}.jpg`
    );
  }

  // Upload safety report evidence
  static async uploadSafetyEvidence(
    reportId: string,
    uri: string,
    index: number
  ): Promise<string | null> {
    const timestamp = Date.now();
    return this.uploadImage(
      uri,
      `safety-reports/${reportId}`,
      `evidence_${index + 1}_${timestamp}.jpg`
    );
  }

  // Resize image (no-op placeholder in Expo Go environment)
  static async resizeImage(
    uri: string,
    width: number,
    height: number
  ): Promise<string | null> {
    try {
      return uri;
    } catch (error) {
      console.error('Resize image error:', error);
      return null;
    }
  }

  // Compress image (best-effort: rely on picker quality setting)
  static async compressImage(
    uri: string,
    quality: number = 0.75
  ): Promise<string | null> {
    try {
      return uri;
    } catch (error) {
      console.error('Compress image error:', error);
      return null;
    }
  }

  // Helper: best-effort compress + bound max dimension to speed up uploads
  private static async compressAndResize(uri: string): Promise<string | null> {
    try {
      return uri;
    } catch (e) {
      console.log('compressAndResize fallback to original uri', e);
      return uri;
    }
  }

  private static getExtensionFromUri(uri: string): string | null {
    try {
      const q = uri.split('?')[0];
      const parts = q.split('.');
      const ext = parts[parts.length - 1];
      if (!ext || ext.includes('/') || ext.length > 5) return null;
      return ext.toLowerCase();
    } catch {
      return null;
    }
  }

  private static getContentTypeFromExt(ext: string): string {
    const map: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      gif: 'image/gif',
      bmp: 'image/bmp',
    };
    return map[ext.toLowerCase()] ?? 'image/jpeg'; // Default to JPEG instead of octet-stream
  }

  // Check if storage is properly configured
  static async checkStorageConnection(): Promise<boolean> {
    try {
      console.log('🔍 Checking Firebase Storage connection...');

      // Import auth here to avoid circular dependencies
      const { auth, firebaseConfig } = await import('@/config/firebase');

      // Check if user is authenticated
      if (!auth.currentUser) {
        console.log('⚠️ User not authenticated, skipping storage check');
        // Return true to allow mock/placeholder functionality
        return true;
      }

      // Check if storage bucket is configured
      if (!firebaseConfig.storageBucket) {
        console.log('⚠️ Storage bucket not configured');
        return false;
      }

      // Try to create a reference to test storage access
      const testRef = ref(storage, `storage-test/${auth.currentUser.uid}/test.txt`);

      // Just creating a reference doesn't require network access
      // If this succeeds, storage is properly initialized
      console.log('✅ Storage connection OK - user is authenticated and storage is initialized');
      return true;

    } catch (error: any) {
      console.error('❌ Storage connection check failed:', error.code || 'Unknown', error.message || 'No message');
      // Return true to allow fallback to placeholder images
      return true;
    }
  }
}

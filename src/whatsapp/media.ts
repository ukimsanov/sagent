/**
 * WhatsApp Media API Utilities
 *
 * Handles downloading media files (audio, images, documents, etc.) from WhatsApp
 * using the Graph API Media endpoints.
 */

// ============================================================================
// Types
// ============================================================================

export interface MediaInfo {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}

export interface DownloadedMedia {
  data: ArrayBuffer;
  mimeType: string;
  sha256: string;
  fileSize: number;
}

// ============================================================================
// Media Download Functions
// ============================================================================

/**
 * Get media download URL from WhatsApp using media ID
 *
 * @param mediaId - Media ID from webhook (e.g., audio.id, image.id)
 * @param accessToken - WhatsApp access token
 * @returns Media info including download URL
 */
export async function getMediaUrl(
  mediaId: string,
  accessToken: string
): Promise<MediaInfo> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get media URL: ${response.status} - ${error}`);
  }

  const mediaInfo = await response.json() as MediaInfo;
  return mediaInfo;
}

/**
 * Download media file from WhatsApp URL
 *
 * Note: The URL from getMediaUrl() is temporary and requires the access token
 *
 * @param mediaUrl - Download URL from getMediaUrl()
 * @param accessToken - WhatsApp access token
 * @param expectedMimeType - Optional: verify mime type matches
 * @returns Downloaded media as ArrayBuffer with metadata
 */
export async function downloadMedia(
  mediaUrl: string,
  accessToken: string,
  expectedMimeType?: string
): Promise<DownloadedMedia> {
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  const data = await response.arrayBuffer();

  // Verify mime type if provided
  if (expectedMimeType && !mimeType.startsWith(expectedMimeType.split('/')[0])) {
    console.warn(`MIME type mismatch: expected ${expectedMimeType}, got ${mimeType}`);
  }

  return {
    data,
    mimeType,
    sha256: '', // Populated by caller if needed
    fileSize: data.byteLength
  };
}

/**
 * Download audio file from WhatsApp
 * Convenience function that combines getMediaUrl and downloadMedia
 *
 * @param audioId - Audio media ID from webhook
 * @param accessToken - WhatsApp access token
 * @returns Downloaded audio data
 */
export async function downloadAudio(
  audioId: string,
  accessToken: string
): Promise<DownloadedMedia> {
  // Step 1: Get download URL
  const mediaInfo = await getMediaUrl(audioId, accessToken);

  // Step 2: Download the file
  const media = await downloadMedia(
    mediaInfo.url,
    accessToken,
    'audio/' // Verify it's audio
  );

  // Add metadata from mediaInfo
  return {
    ...media,
    sha256: mediaInfo.sha256,
    fileSize: mediaInfo.file_size
  };
}

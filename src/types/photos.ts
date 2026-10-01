export type PhotoQuality = 'standard' | 'original'

export interface PhotoInfo {
  id: string
  groupId: string
  groupName: string
  tripStart: string
  name: string
  mimeType: string
  size: number
  date: string
  itineraryId: string
  itineraryTitle: string
  quality: PhotoQuality
  uploaderId: string
  uploaderName: string
  createdAt: number
}

export interface LocalPhoto extends PhotoInfo {
  uid: string
  blob: Blob
  backupId: string
  backupRevision: string
  sharedFileId: string
  sharedThumbnailId?: string
  sharedUntil: number
  sharedGroupId: string
  backupState: 'pending' | 'running' | 'done' | 'failed'
}

export interface SharedPhoto extends PhotoInfo {
  driveFileId: string
  thumbnailId?: string
  expiresAt: number
  deleted: boolean
}

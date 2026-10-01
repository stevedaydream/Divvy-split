import { describe, expect, it } from 'vitest'
import { daysUntilExpiry, photoInfo, photoSections, restorePhoto, safePhotoPath, tripPhotoDay, validPhotoDate, validatePhotoInfo } from '../photos'
import { photoArchive, readPhotoArchive } from '@/services/photoFiles'
import type { PhotoInfo } from '@/types/photos'

const photo: PhotoInfo = { id: 'photo-1', groupId: 'group-1', groupName: '水肺旅行', tripStart: '2026-10-01', name: '海龜.jpg', mimeType: 'image/jpeg', size: 3, date: '2026-10-02', itineraryId: 'spot', itineraryTitle: '潛水', quality: 'original', uploaderId: 'synthetic-user', uploaderName: '測試同行者', createdAt: 1000 }

describe('相簿分類與到期', () => {
  it('以日曆日期計算旅行天數，無效與旅行前日期不冒充第一天', () => {
    expect(tripPhotoDay(photo.tripStart, photo.date)).toBe(2)
    expect(tripPhotoDay('2024-02-28', '2024-03-01')).toBe(3)
    expect(tripPhotoDay('', photo.date)).toBeNull()
    expect(tripPhotoDay('2026-10-03', photo.date)).toBeNull()
    expect(validPhotoDate('2026-02-30')).toBe(false)
  })
  it('相同名稱不同揪團保持獨立；依日期分組', () => {
    const sections = photoSections([photo, { ...photo, id: 'photo-2', date: '2026-10-01' }, { ...photo, id: 'photo-3', groupId: 'group-2' }])
    expect(sections).toHaveLength(3)
    expect(sections[0]?.day).toBe(1)
  })
  it('在第 23／29／30 天正確顯示到期天數', () => {
    const expires = 30 * 86400000
    expect(daysUntilExpiry(expires, 23 * 86400000)).toBe(7)
    expect(daysUntilExpiry(expires, 29 * 86400000)).toBe(1)
    expect(daysUntilExpiry(expires, 30 * 86400000)).toBe(0)
  })
})

describe('本機與 ZIP 還原', () => {
  it('還原不帶入其他裝置帳號、Drive 檔案或分享權限', async () => {
    const original = restorePhoto(photo, new Blob(['abc'], { type: 'image/jpeg' }), 'device-user-a')
    original.backupId = 'private-backup'; original.sharedFileId = 'shared-file'; original.backupState = 'done'
    const archive = await photoArchive([original])
    const [restored] = await readPhotoArchive(archive, 'device-user-b')
    expect(restored?.uid).toBe('device-user-b')
    expect(restored?.backupId).toBe('')
    expect(restored?.sharedFileId).toBe('')
    expect(restored?.itineraryTitle).toBe('潛水')
    expect(await restored?.blob.text()).toBe('abc')
    expect(photoInfo(restored!)).toEqual(photo)
  })
  it('拒絕檔案大小不符、可執行圖檔與無效日期', () => {
    expect(() => restorePhoto(photo, new Blob(['ab']), 'me')).toThrow('invalid-archive')
    expect(validatePhotoInfo({ ...photo, mimeType: 'image/svg+xml' })).toBe(false)
    expect(validatePhotoInfo({ ...photo, date: '2026-02-30' })).toBe(false)
  })
  it('ZIP 路徑不允許目錄跳脫，分批限制可避免大批記憶體耗盡', async () => {
    expect(safePhotoPath({ ...photo, groupName: '../水肺', name: '../photo.jpg' })).not.toContain('../')
    const local = restorePhoto(photo, new Blob(['abc']), 'me')
    await expect(photoArchive(Array.from({ length: 51 }, () => local))).rejects.toThrow('archive-limit')
    await expect(readPhotoArchive(new Blob(['not zip']), 'me')).rejects.toThrow()
  })
})

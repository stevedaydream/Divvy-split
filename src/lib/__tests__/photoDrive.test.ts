import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ auth: { currentUser: { uid: 'user-a' } as { uid: string } | null }, scopes: [] as string[], standalone: false }))
vi.mock('@/lib/firebase', () => ({ auth: state.auth }))
vi.mock('@/lib/browserEnv', () => ({ isStandalone: () => state.standalone }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {
    addScope(scope: string) { state.scopes.push(scope) }
    static credentialFromResult() { return { accessToken: 'synthetic-test-token' } }
  },
  onAuthStateChanged: vi.fn(),
  reauthenticateWithPopup: async () => ({ user: state.auth.currentUser }),
  reauthenticateWithRedirect: vi.fn(),
}))
import { acceptDriveRedirect, connectDrive, disconnectDrive, driveConnected, driveFiles, readDrivePhoto, shareDrivePhoto, uploadDrivePhoto } from '@/services/photoDrive'
import type { UserCredential } from 'firebase/auth'

const fetchMock = vi.fn<typeof fetch>()
function reply(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
beforeEach(async () => {
  state.auth.currentUser = { uid: 'user-a' }; state.scopes = []; state.standalone = false
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset()
  disconnectDrive(); await connectDrive()
})
afterEach(() => { disconnectDrive(); vi.unstubAllGlobals() })

describe('Drive 最小權限與失敗處理', () => {
  it('安裝版 PWA 使用跳轉授權；裝置只存連線意圖，不存 token', async () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) })
    disconnectDrive(); state.standalone = true
    await connectDrive()
    expect(driveConnected.value).toBe(false)
    expect([...storage.values()]).toEqual(['user-a'])
    acceptDriveRedirect({ operationType: 'reauthenticate', user: state.auth.currentUser } as UserCredential)
    expect(driveConnected.value).toBe(true)
    expect(storage.size).toBe(0)
  })
  it('只要求 drive.file，清理只查本人擁有的檔案', async () => {
    fetchMock.mockResolvedValueOnce(reply({ files: [] }))
    await driveFiles('shared')
    expect(state.scopes).toEqual(['https://www.googleapis.com/auth/drive.file'])
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.searchParams.get('q')).toContain("'me' in owners")
  })
  it('帳號切換後拒絕使用上一個帳號的 token', async () => {
    state.auth.currentUser = { uid: 'user-b' }
    await expect(driveFiles('backup')).rejects.toThrow('drive-connect')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(driveConnected.value).toBe(false)
  })
  it('指定使用者唯讀分享；到期權限不支援時不改為公開', async () => {
    fetchMock.mockResolvedValueOnce(reply({ permissions: [] }))
      .mockResolvedValueOnce(reply({ error: { message: 'expirationTime is unsupported' } }, 400))
      .mockResolvedValueOnce(reply({ id: 'permission' }))
    await shareDrivePhoto('image-id', 'peer@example.test', Date.now() + 86400000)
    const body = JSON.parse(String(fetchMock.mock.calls[2]![1]?.body))
    expect(body).toEqual({ type: 'user', role: 'reader', emailAddress: 'peer@example.test' })
    expect(String(fetchMock.mock.calls[2]![0])).toContain('sendNotificationEmail=false')
  })
  it('授權過期會中止連線，404 列為檔案不可讀', async () => {
    fetchMock.mockResolvedValueOnce(reply({ permissions: [] })).mockResolvedValueOnce(reply({}, 401))
    await expect(shareDrivePhoto('image-id', 'peer@example.test', Date.now() + 86400000)).rejects.toThrow('drive-connect')
    expect(driveConnected.value).toBe(false)
    await connectDrive()
    fetchMock.mockResolvedValueOnce(reply({}, 404))
    await expect(readDrivePhoto('missing')).rejects.toThrow('drive-file')
  })
  it('不使用已共用的備份資料夾，另建私人資料夾', async () => {
    fetchMock.mockResolvedValueOnce(reply({ files: [{ id: 'shared-folder' }] }))
      .mockResolvedValueOnce(reply({ permissions: [{ role: 'owner' }, { role: 'reader' }] }))
      .mockResolvedValueOnce(reply({ id: 'private-folder' }))
      .mockResolvedValueOnce(reply({ id: 'new-backup' }))
    await expect(uploadDrivePhoto(new Blob(['photo']), 'photo.zip', { divvyKind: 'backup' })).resolves.toBe('new-backup')
    const multipart = await (fetchMock.mock.calls[3]![1]?.body as Blob).text()
    expect(multipart).toContain('private-folder')
    expect(multipart).not.toContain('shared-folder')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/permissions?sendNotificationEmail'))).toBe(false)
  })
  it('下載前拒絕超大檔案，避免無限制載入記憶體', async () => {
    fetchMock.mockResolvedValueOnce(new Response('tiny', { headers: { 'Content-Length': String(101 * 1024 * 1024) } }))
    await expect(readDrivePhoto('oversized')).rejects.toThrow('archive-limit')
  })
})

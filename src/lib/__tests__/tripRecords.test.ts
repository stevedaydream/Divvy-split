import { describe, expect, it } from 'vitest'
import { copyTripPlan, tripSnapshot } from '../tripRecords'
import { newPackingTexts } from '../packingTemplates'
import type { Group, ItineraryItem, TripRecord } from '@/types/models'

const group: Group = {
  id: 'trip', name: '潛水旅行', currency: 'TWD', destination: 'TW', location: '墾丁',
  startDate: '2026-09-28', endDate: '2026-09-30', ownerId: 'a', memberIds: ['a'],
  members: { a: { nickname: '測試成員', payment: { bankName: '測試銀行', bankAccount: '僅測試' } } },
  inviteCode: 'test-only', archived: true, createdAt: null, updatedAt: null,
}
const item: ItineraryItem = {
  id: 'hotel', kind: 'lodging', date: '2026-09-28', time: '15:00', endDate: '2026-09-30',
  title: '住宿', place: '墾丁', note: '下次參考備註', estimateMinor: 300000, category: 'lodging', updatedBy: 'a', updatedAt: null,
}
const record: TripRecord = { ...tripSnapshot(group, [item]), id: group.id, savedAt: null }

describe('個人旅行紀錄與範本', () => {
  it('只保存旅行內容，不帶入成員、收款、邀請碼與編輯者資料', () => {
    const snapshot = tripSnapshot(group, [item])
    expect(snapshot).not.toHaveProperty('members')
    expect(snapshot).not.toHaveProperty('inviteCode')
    expect(snapshot.items[0]).not.toHaveProperty('updatedBy')
    expect(snapshot.items[0]?.note).toBe(item.note)
    item.note = '群組後來修改'
    expect(snapshot.items[0]?.note).toBe('下次參考備註')
    item.note = '下次參考備註'
  })

  it('換日期複製行程時同步搬移住宿退房日，保留時間與備註', () => {
    const copy = copyTripPlan(record, '2027-02-28')
    expect(copy.endDate).toBe('2027-03-02')
    expect(copy.items[0]).toMatchObject({ date: '2027-02-28', endDate: '2027-03-02', time: '15:00', note: '下次參考備註' })
    expect(record.items[0]?.date).toBe('2026-09-28')
  })

  it('沒有旅行日期時以最早行程為起點，完整保留各日間隔', () => {
    const copy = copyTripPlan({ ...record, startDate: '', endDate: '' }, '2027-01-01')
    expect(copy.endDate).toBe('2027-01-03')
    expect(copy.items[0]?.date).toBe('2027-01-01')
  })

  it('套用多個範本會略過現有項目與範本內重複文字', () => {
    expect(newPackingTexts(['面鏡', '泳衣'], [' 面鏡 ', '蛙鞋', '蛙鞋', '防寒衣', ''])).toEqual(['蛙鞋', '防寒衣'])
    expect(newPackingTexts(['面鏡', '蛙鞋', '防寒衣'], ['面鏡', '蛙鞋'])).toEqual([])
  })
})

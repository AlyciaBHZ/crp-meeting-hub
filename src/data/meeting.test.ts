import { describe, expect, it } from 'vitest'
import { upcomingMeeting } from './meeting'

const expectedGroups = [
  "Prof Zhang Yang's group",
  "Prof Li Yang's group",
  "Prof Low Jun Siong's group",
  "Prof Tan Yong Zi's group",
  "Prof Wu Wei's group",
  "Prof Li Qi Jing's group",
]

function minutes(time: string) {
  const [hours, minute] = time.split(':').map(Number)
  return hours * 60 + minute
}

describe('upcomingMeeting', () => {
  it('contains the supplied six presentation groups in order', () => {
    expect(upcomingMeeting.slots.map((slot) => slot.groupName)).toEqual(expectedGroups)
  })

  it('uses contiguous 20-minute slots from 09:00 to 11:00', () => {
    expect(upcomingMeeting.slots[0].startsAt).toBe('09:00')
    expect(upcomingMeeting.slots.at(-1)?.endsAt).toBe('11:00')

    upcomingMeeting.slots.forEach((slot, index) => {
      expect(minutes(slot.endsAt) - minutes(slot.startsAt)).toBe(20)
      if (index > 0) {
        expect(slot.startsAt).toBe(upcomingMeeting.slots[index - 1].endsAt)
      }
    })
  })

  it('allocates 15 minutes to presentation and 5 minutes to Q&A', () => {
    expect(upcomingMeeting.presentationMinutes).toBe(15)
    expect(upcomingMeeting.qaMinutes).toBe(5)
  })
})

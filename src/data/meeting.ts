export type SlideStatus = 'awaiting' | 'uploaded'

export interface AgendaSlot {
  id: string
  startsAt: string
  endsAt: string
  groupName: string
  slideStatus: SlideStatus
  slideFileName?: string
}

export interface Meeting {
  id: string
  title: string
  date?: string
  venue?: string
  timezone: string
  presentationMinutes: number
  qaMinutes: number
  slots: AgendaSlot[]
}

export const upcomingMeeting: Meeting = {
  id: 'crp-upcoming',
  title: 'CRP Grant Meeting',
  timezone: 'Asia/Singapore',
  presentationMinutes: 15,
  qaMinutes: 5,
  slots: [
    { id: 'zhang-yang', startsAt: '09:00', endsAt: '09:20', groupName: "Prof Zhang Yang's group", slideStatus: 'awaiting' },
    { id: 'li-yang', startsAt: '09:20', endsAt: '09:40', groupName: "Prof Li Yang's group", slideStatus: 'awaiting' },
    { id: 'low-jun-siong', startsAt: '09:40', endsAt: '10:00', groupName: "Prof Low Jun Siong's group", slideStatus: 'awaiting' },
    { id: 'tan-yong-zi', startsAt: '10:00', endsAt: '10:20', groupName: "Prof Tan Yong Zi's group", slideStatus: 'awaiting' },
    { id: 'wu-wei', startsAt: '10:20', endsAt: '10:40', groupName: "Prof Wu Wei's group", slideStatus: 'awaiting' },
    { id: 'li-qi-jing', startsAt: '10:40', endsAt: '11:00', groupName: "Prof Li Qi Jing's group", slideStatus: 'awaiting' },
  ],
}


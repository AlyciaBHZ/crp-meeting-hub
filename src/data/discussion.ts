export type QuestionStatus = 'open' | 'meeting' | 'answered' | 'follow_up'
export type PdfBucket = 'slides' | 'archive-lab-files' | 'minutes'

export interface PdfResource {
  bucket: PdfBucket
  path: string
  name: string
  page?: number
}

export interface QuestionDraft {
  authorName: string
  authorGroup: string
  body: string
  fileSource?: 'slides' | 'archive-lab-files'
  fileId?: string
  pageNumber?: number
}

export interface ReplyDraft {
  authorName: string
  authorGroup: string
  body: string
}

export interface DiscussionReply {
  id: string
  question_id: string
  author_name: string
  author_group: string
  body: string
  created_at: string
}

export interface DiscussionQuestion extends Omit<DiscussionReply, 'question_id'> {
  agenda_slot_id: string
  status: QuestionStatus
  file_source: 'slides' | 'archive-lab-files' | null
  file_id: string | null
  file_name: string | null
  page_number: number | null
  replies: DiscussionReply[]
}

export const questionStatuses: Record<QuestionStatus, string> = {
  open: 'Open',
  meeting: 'Discuss at meeting',
  answered: 'Answered',
  follow_up: 'Follow-up needed',
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { DiscussionQuestion, DiscussionReply, QuestionDraft, QuestionStatus, ReplyDraft } from '../data/discussion'

function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export function createDiscussionRepository(client: SupabaseClient) {
  return {
    async list(slotId: string): Promise<DiscussionQuestion[]> {
      const questions = checked(await client.from('meeting_questions').select('*').eq('agenda_slot_id', slotId).order('created_at', { ascending: false })) ?? []
      if (!questions.length) return []
      const replies = checked(await client.from('meeting_replies').select('*').in('question_id', questions.map((q) => q.id)).order('created_at')) ?? []
      return questions.map((question) => ({
        ...question,
        replies: replies.filter((reply) => reply.question_id === question.id) as DiscussionReply[],
      })) as DiscussionQuestion[]
    },
    async ask(slotId: string, draft: QuestionDraft) {
      return checked(await client.rpc('ask_meeting_question', {
        slot_id_input: slotId,
        author_name_input: draft.authorName.trim(),
        author_group_input: draft.authorGroup.trim(),
        body_input: draft.body.trim(),
        file_source_input: draft.fileSource ?? null,
        file_id_input: draft.fileId ?? null,
        page_number_input: draft.pageNumber ?? null,
      }))
    },
    async reply(questionId: string, draft: ReplyDraft) {
      return checked(await client.rpc('reply_to_meeting_question', {
        question_id_input: questionId,
        author_name_input: draft.authorName.trim(),
        author_group_input: draft.authorGroup.trim(),
        body_input: draft.body.trim(),
      }))
    },
    async setStatus(questionId: string, status: QuestionStatus) {
      return checked(await client.rpc('set_meeting_question_status', { question_id_input: questionId, status_input: status }))
    },
  }
}

export type DiscussionRepository = ReturnType<typeof createDiscussionRepository>

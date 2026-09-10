import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Discussion } from './Discussion'
import type { DiscussionQuestion } from '../data/discussion'
import type { AgendaSlot } from '../data/meeting'

const slot: AgendaSlot = { id: 'slot', startsAt: '09:00', endsAt: '09:20', groupName: 'Yang group', slideStatus: 'uploaded', groupMemberIds: ['owner'], slideFiles: [{ id: 'file', agendaSlotId: 'slot', displayName: 'Experiment', originalName: 'experiment.pdf', objectPath: 'private/file.pdf', sizeBytes: 100, uploadedBy: 'owner', uploadedAt: '2026-09-10' }] }
const question: DiscussionQuestion = { id: 'question', agenda_slot_id: 'slot', author_name: 'Wenlin', author_group: 'Research group', body: 'What is the baseline?', status: 'open', file_source: 'slides', file_id: 'file', file_name: 'experiment.pdf', page_number: 2, created_at: '2026-09-10T01:00:00Z', replies: [] }
const makeRepository = () => ({ list: vi.fn().mockResolvedValue([question]), ask: vi.fn().mockResolvedValue('new'), reply: vi.fn().mockResolvedValue('reply'), setStatus: vi.fn().mockResolvedValue(undefined) })

describe('group discussion interactions', () => {
  it('loads on expansion, opens a referenced page, and keeps status controls for assigned members', async () => {
    const repository = makeRepository()
    const preview = vi.fn()
    render(<Discussion slot={slot} profile={{ id: 'visitor', role: 'presenter' }} repository={repository} onPreview={preview} />)
    expect(repository.list).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /Questions & discussion/ }))
    await screen.findByText('What is the baseline?')
    expect(screen.queryByRole('combobox', { name: /Status of question/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'View referenced PDF' }))
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'slides', path: 'private/file.pdf', page: 2 }))
    await userEvent.click(screen.getByRole('button', { name: /^Reply$/ }))
    const reply = screen.getByLabelText('Your reply').closest('form')!
    await userEvent.type(within(reply).getByLabelText('Your name'), 'Yang')
    await userEvent.type(within(reply).getByLabelText('Your group'), 'Lab')
    await userEvent.type(within(reply).getByLabelText('Your reply'), 'The control sample.')
    await userEvent.click(within(reply).getByRole('button', { name: 'Post reply' }))
    expect(repository.reply).toHaveBeenCalledWith('question', { authorName: 'Yang', authorGroup: 'Lab', body: 'The control sample.' })
  })

  it('preserves a failed question draft and posts its PDF/page reference on retry', async () => {
    const repository = makeRepository()
    repository.ask.mockRejectedValueOnce(new Error('Connection interrupted'))
    render(<Discussion slot={slot} profile={{ id: 'owner', role: 'presenter' }} repository={repository} />)
    await userEvent.click(screen.getByRole('button', { name: /Questions & discussion/ }))
    const form = screen.getByRole('form', { name: 'Ask a question' })
    await userEvent.type(within(form).getByLabelText('Your name'), 'Wenlin')
    await userEvent.type(within(form).getByLabelText('Your group'), 'Lab')
    await userEvent.type(within(form).getByLabelText('Your question'), 'Please explain the baseline.')
    await userEvent.selectOptions(within(form).getByLabelText('Related PDF (optional)'), 'slides:file')
    await userEvent.type(within(form).getByLabelText('Page (optional)'), '2')
    await userEvent.click(within(form).getByRole('button', { name: 'Post question' }))
    await screen.findByText('Connection interrupted')
    expect(within(form).getByLabelText('Your question')).toHaveValue('Please explain the baseline.')
    await userEvent.click(within(form).getByRole('button', { name: 'Post question' }))
    expect(repository.ask).toHaveBeenLastCalledWith('slot', expect.objectContaining({ fileSource: 'slides', fileId: 'file', pageNumber: 2 }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Status of question/ }), 'meeting')
    expect(repository.setStatus).toHaveBeenCalledWith('question', 'meeting')
  })
})

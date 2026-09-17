import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MeetingCollection } from './MeetingCollection'
import type { Meeting } from '../data/meeting'

const file = { id: 'legacy', meetingId: 'meeting', groupId: 'group', groupName: 'Lab', originalName: 'legacy.pdf', objectPath: 'meeting/group/legacy.pdf', sizeBytes: 100, uploadedAt: '2026-08-05' }
const meeting: Meeting = {
  id: 'meeting', title: 'CRP', date: '5 Aug 2026', dateISO: '2026-08-05', timezone: 'Asia/Singapore', presentationMinutes: 15, qaMinutes: 5,
  minutesFileName: 'minutes.pdf', minutesObjectPath: 'meeting/minutes', archiveFiles: [file],
  slots: [{ id: 'slot', groupId: 'group', groupName: 'Lab', startsAt: '09:00', endsAt: '09:20', slideStatus: 'uploaded' }],
}

describe('administrator file deletion', () => {
  it('requires confirmation for legacy PDFs and shows failed deletion without removing the file', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('Storage unavailable')).mockResolvedValue(undefined)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    render(<MeetingCollection view="archive" meetings={[meeting]} profile={{ id: 'admin', role: 'admin' }} onRemoveArchiveFile={remove} />)
    const button = screen.getByRole('button', { name: 'Remove legacy.pdf' })
    await userEvent.click(button)
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(button)
    expect(confirm).toHaveBeenLastCalledWith(expect.stringContaining('cannot be undone'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable')
    expect(screen.getByText('legacy.pdf')).toBeVisible()
    await userEvent.click(button)
    expect(remove).toHaveBeenLastCalledWith(meeting, file)
    expect(await screen.findByText('PDF removed.')).toBeVisible()
  })

  it('keeps minutes deletion available when collapsed, prevents duplicate deletion, and returns to upload after refresh', async () => {
    let finish!: () => void
    const remove = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const props = { view: 'archive' as const, profile: { id: 'admin', role: 'admin' as const }, onRemoveMinutes: remove }
    const { rerender } = render(<MeetingCollection {...props} meetings={[meeting]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Collapse meeting' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete minutes' }))
    expect(screen.getByRole('button', { name: 'Deleting minutes...' })).toBeDisabled()
    expect(remove).toHaveBeenCalledWith(meeting)
    finish()
    await screen.findByText('Minutes deleted.')
    rerender(<MeetingCollection {...props} meetings={[{ ...meeting, minutesFileName: undefined, minutesObjectPath: undefined }]} />)
    expect(screen.queryByRole('button', { name: 'Delete minutes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload minutes' })).toBeVisible()
  })

  it('does not offer legacy PDF or minutes deletion to ordinary members', () => {
    render(<MeetingCollection view="archive" meetings={[meeting]} profile={{ id: 'member', role: 'presenter' }} onRemoveArchiveFile={vi.fn()} onRemoveMinutes={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Remove legacy.pdf' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete minutes' })).not.toBeInTheDocument()
  })
})

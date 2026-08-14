import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Meeting } from '../data/meeting'
import { ArchiveLabFiles } from './ArchiveLabFiles'

const meeting: Meeting = {
  id: 'meeting-1', title: 'CRP Grant Meeting', dateISO: '2026-06-14', timezone: 'Asia/Singapore',
  presentationMinutes: 15, qaMinutes: 5,
  slots: [
    { id: 'slot-1', startsAt: '09:00', endsAt: '09:20', groupId: 'group-1', groupName: 'Group 1', groupMemberIds: ['member-1'], slideStatus: 'awaiting' },
    { id: 'slot-2', startsAt: '09:20', endsAt: '09:40', groupId: 'group-2', groupName: 'Group 2', groupMemberIds: ['member-2'], slideStatus: 'awaiting' },
  ],
  archiveFiles: [],
}

describe('ArchiveLabFiles', () => {
  it('only offers a presenter Labs they belong to', () => {
    render(<ArchiveLabFiles meeting={meeting} profile={{ id: 'member-1', role: 'presenter' }} onUpload={vi.fn()} onDownload={vi.fn()} />)
    expect(screen.getByRole('option', { name: 'Group 1' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Group 2' })).not.toBeInTheDocument()
  })

  it('shows the per-Lab meeting count and disables a full Lab', () => {
    const archiveFiles = Array.from({ length: 20 }, (_, index) => ({
      id: `file-${index}`, meetingId: 'meeting-1', groupId: 'group-1', groupName: 'Group 1', originalName: `${index}.pdf`,
      objectPath: `meeting-1/group-1/file-${index}.pdf`, sizeBytes: 10, uploadedAt: '2026-06-15T01:00:00Z',
    }))
    render(<ArchiveLabFiles meeting={{ ...meeting, archiveFiles }} profile={{ id: 'member-1', role: 'presenter' }} onUpload={vi.fn()} onDownload={vi.fn()} />)
    expect(screen.getAllByText('20 / 20 PDFs')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Upload PDFs' })).toBeDisabled()
  })
})

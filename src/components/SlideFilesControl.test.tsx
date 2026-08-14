import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AgendaSlot, SlideFile } from '../data/meeting'
import { SlideFilesControl } from './SlideFilesControl'

const slot: AgendaSlot = {
  id: 'slot-1', startsAt: '13:30', endsAt: '14:10', groupId: 'group-1', groupName: 'Group 1',
  groupMemberIds: ['member-1'], slideStatus: 'awaiting', slideFiles: [],
}

function slideFile(index: number): SlideFile {
  return {
    id: `file-${index}`, agendaSlotId: 'slot-1', displayName: `Presenter ${index}`,
    originalName: `slides-${index}.pdf`, objectPath: `slot-1/file-${index}.pdf`, sizeBytes: 2048,
    uploadedBy: 'member-1', uploadedAt: '2026-08-14T01:00:00Z',
  }
}

describe('SlideFilesControl', () => {
  it('uploads one PDF with a required presenter or document name', async () => {
    const onUpload = vi.fn(() => Promise.resolve())
    render(<SlideFilesControl slot={slot} profile={{ id: 'member-1', role: 'presenter' }} enabled onUpload={onUpload} />)

    const pdf = new File(['pdf'], 'immune-update.pdf', { type: 'application/pdf' })
    await userEvent.type(screen.getByLabelText('Presenter / document name'), '  Yang Li update  ')
    await userEvent.upload(screen.getByLabelText('PDF file for Group 1'), pdf)
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }))

    expect(onUpload).toHaveBeenCalledWith(slot, 'Yang Li update', pdf)
    expect(screen.getByText('PDF uploaded.')).toBeInTheDocument()
  })

  it('rejects PowerPoint files and shows the 20-file capacity', async () => {
    const onUpload = vi.fn(() => Promise.resolve())
    render(<SlideFilesControl slot={slot} profile={{ id: 'member-1', role: 'presenter' }} enabled onUpload={onUpload} />)

    await userEvent.type(screen.getByLabelText('Presenter / document name'), 'Yang Li update')
    fireEvent.change(screen.getByLabelText('PDF file for Group 1'), {
      target: { files: [new File(['pptx'], 'slides.pptx')] },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Please choose a PDF file.')
    expect(onUpload).not.toHaveBeenCalled()
    expect(screen.getByText('0 / 20 PDFs')).toBeInTheDocument()
  })

  it('lists named PDFs and exposes download and authorized removal actions', async () => {
    const file = slideFile(1)
    const onDownload = vi.fn(() => Promise.resolve())
    const onRemove = vi.fn(() => Promise.resolve())
    const { rerender } = render(
      <SlideFilesControl slot={{ ...slot, slideStatus: 'uploaded', slideFiles: [file] }} profile={{ id: 'member-1', role: 'presenter' }} enabled onDownload={onDownload} onRemove={onRemove} />,
    )

    expect(screen.getByText('Presenter 1')).toBeInTheDocument()
    expect(screen.getByText(/slides-1\.pdf/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Download Presenter 1' }))
    expect(onDownload).toHaveBeenCalledWith(file)
    expect(screen.getByRole('button', { name: 'Remove Presenter 1' })).toBeInTheDocument()

    rerender(<SlideFilesControl slot={{ ...slot, slideFiles: [file] }} profile={{ id: 'member-2', role: 'presenter' }} enabled={false} onRemove={onRemove} />)
    expect(screen.queryByRole('button', { name: 'Remove Presenter 1' })).not.toBeInTheDocument()

    rerender(<SlideFilesControl slot={{ ...slot, slideFiles: [file] }} profile={{ id: 'admin-1', role: 'admin' }} enabled onRemove={onRemove} />)
    expect(screen.getByRole('button', { name: 'Remove Presenter 1' })).toBeInTheDocument()
  })

  it('removes a PDF only after confirmation', async () => {
    const file = slideFile(1)
    const onRemove = vi.fn(() => Promise.resolve())
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <SlideFilesControl slot={{ ...slot, slideStatus: 'uploaded', slideFiles: [file] }} profile={{ id: 'member-1', role: 'presenter' }} enabled onRemove={onRemove} />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Remove Presenter 1' }))

    expect(confirm).toHaveBeenCalledWith('Remove Presenter 1?')
    expect(onRemove).toHaveBeenCalledWith(file)
    expect(screen.getByText('PDF removed.')).toBeInTheDocument()
  })

  it('disables selection and upload when the Lab already has 20 PDFs', () => {
    render(<SlideFilesControl slot={{ ...slot, slideFiles: Array.from({ length: 20 }, (_, index) => slideFile(index)) }} profile={{ id: 'member-1', role: 'presenter' }} enabled onUpload={vi.fn()} />)

    expect(screen.getAllByText('20 / 20 PDFs')).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Choose PDF' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Upload PDF' })).toBeDisabled()
  })
})

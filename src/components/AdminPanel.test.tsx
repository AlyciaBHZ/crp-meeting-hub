import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminPanel } from './AdminPanel'

describe('AdminPanel', () => {
  it('adds an approved presenter email', async () => {
    const addMember = vi.fn(() => Promise.resolve())
    render(<AdminPanel meeting={{ id: 'meeting-1' }} profiles={[]} slots={[]} onAddMember={addMember} onAssign={vi.fn()} onUpdateMeeting={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Member email'), 'presenter@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Add member' }))
    expect(addMember).toHaveBeenCalledWith('presenter@example.com', 'presenter')
  })

  it('updates the meeting schedule', async () => {
    const updateMeeting = vi.fn(() => Promise.resolve())
    render(<AdminPanel meeting={{ id: 'meeting-1', dateISO: '2026-09-01', venue: '' }} profiles={[]} slots={[]} onAddMember={vi.fn()} onAssign={vi.fn()} onUpdateMeeting={updateMeeting} />)
    expect(screen.getByLabelText('Meeting date')).toHaveValue('2026-09-01')
    await userEvent.type(screen.getByLabelText('Venue'), 'Seminar Room')
    await userEvent.click(screen.getByRole('button', { name: 'Save schedule' }))
    expect(updateMeeting).toHaveBeenCalledWith('2026-09-01', 'Seminar Room')
  })
})

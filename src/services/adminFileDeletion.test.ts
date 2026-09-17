import { describe, expect, it, vi } from 'vitest'
import { createMeetingRepository } from './meetingRepository'

describe('file deletion storage and metadata coordination', () => {
  it.each(['archive', 'minutes'] as const)('removes %s storage before metadata and stops on storage failure', async kind => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('Network failed')).mockResolvedValue({ data: [], error: null })
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const from = vi.fn(() => ({ remove }))
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { object_path: 'meeting/minutes' }, error: null }) }
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain)
    const repository = createMeetingRepository({ storage: { from }, rpc, from: () => chain } as never)
    const action = () => kind === 'archive'
      ? repository.deleteArchiveLabFile({ id: 'file', objectPath: 'meeting/group/file.pdf' })
      : repository.deleteMinutes({ id: 'meeting', minutesObjectPath: 'meeting/minutes' })
    await expect(action()).rejects.toThrow('Network failed')
    expect(rpc).not.toHaveBeenCalled()
    await action()
    expect(from).toHaveBeenLastCalledWith(kind === 'archive' ? 'archive-lab-files' : 'minutes')
    expect(rpc).toHaveBeenCalledWith(kind === 'archive' ? 'cancel_archive_lab_file' : 'cancel_meeting_minutes', kind === 'archive' ? { file_id_input: 'file' } : { meeting_id_input: 'meeting', object_path_input: 'meeting/minutes' })
    expect(remove.mock.invocationCallOrder[1]).toBeLessThan(rpc.mock.invocationCallOrder[0])
  })

  it('rejects a stale minutes card before touching the replacement file', async () => {
    const remove = vi.fn()
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { object_path: 'meeting/new-revision/minutes' }, error: null }) }
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain)
    const repository = createMeetingRepository({ storage: { from: () => ({ remove }) }, from: () => chain } as never)
    await expect(repository.deleteMinutes({ id: 'meeting', minutesObjectPath: 'meeting/minutes' })).rejects.toThrow('minutes have changed')
    expect(remove).not.toHaveBeenCalled()
  })

  it('targets only the original object if replacement occurs during deletion', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'The minutes have changed. Refresh this meeting before deleting.' } })
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { object_path: 'meeting/old/minutes' }, error: null }) }
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain)
    const repository = createMeetingRepository({ storage: { from: () => ({ remove }) }, from: () => chain, rpc } as never)
    await expect(repository.deleteMinutes({ id: 'meeting', minutesObjectPath: 'meeting/old/minutes' })).rejects.toThrow('minutes have changed')
    expect(remove).toHaveBeenCalledExactlyOnceWith(['meeting/old/minutes'])
  })

  it('retains both objects when metadata save has an uncertain outcome', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null })
    const upload = vi.fn((path: string) => Promise.resolve({ data: { path }, error: null }))
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { object_path: 'meeting/old/minutes' }, error: null }), upsert: vi.fn().mockResolvedValue({ error: { message: 'Database unavailable' } }) }
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain)
    const repository = createMeetingRepository({ storage: { from: () => ({ remove, upload }) }, from: () => chain } as never)
    await expect(repository.uploadMinutes('meeting', 'admin', new File(['pdf'], 'minutes.pdf'))).rejects.toThrow('Database unavailable')
    expect(remove).not.toHaveBeenCalled()
    expect(upload.mock.calls[0][0]).not.toBe('meeting/old/minutes')
  })
})

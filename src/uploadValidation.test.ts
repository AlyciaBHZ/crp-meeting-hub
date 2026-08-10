import { describe, expect, it } from 'vitest'
import { MAX_SLIDES_SIZE, validateSlidesFile } from './uploadValidation'

function file(name: string, type: string, size = 100) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateSlidesFile', () => {
  it.each([
    ['slides.pdf', 'application/pdf'],
    ['slides.ppt', 'application/vnd.ms-powerpoint'],
    ['slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ])('accepts %s', (name, type) => {
    expect(validateSlidesFile(file(name, type))).toBeNull()
  })

  it('rejects unsupported files', () => {
    expect(validateSlidesFile(file('notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'))).toBe(
      'Please choose a PDF, PPT, or PPTX file.',
    )
  })

  it('rejects files over 50 MB', () => {
    const oversized = new File([], 'slides.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversized, 'size', { value: MAX_SLIDES_SIZE + 1 })
    expect(validateSlidesFile(oversized)).toBe('The file must be 50 MB or smaller.')
  })
})

import { describe, expect, it } from 'vitest'
import { MAX_SLIDES_SIZE, validateMinutesFile, validateSlidesFile } from './uploadValidation'

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

describe('validateMinutesFile', () => {
  it.each([
    ['minutes.pdf', 'application/pdf'],
    ['minutes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['minutes.md', 'text/markdown'],
  ])('accepts %s', (name, type) => {
    expect(validateMinutesFile(file(name, type))).toBeNull()
  })

  it('rejects unsupported and oversized minutes', () => {
    expect(validateMinutesFile(file('minutes.exe', 'application/octet-stream'))).toBe('Please choose a PDF, DOCX, or Markdown file.')
    const oversized = new File([], 'minutes.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversized, 'size', { value: MAX_SLIDES_SIZE + 1 })
    expect(validateMinutesFile(oversized)).toBe('The file must be 50 MB or smaller.')
  })
})

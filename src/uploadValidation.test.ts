import { describe, expect, it } from 'vitest'
import * as uploadValidation from './uploadValidation'

const { MAX_SLIDES_SIZE, validateArchivePdfBatch, validateMinutesFile } = uploadValidation
const validateSlidePdf = (uploadValidation as typeof uploadValidation & {
  validateSlidePdf?: (displayName: string, file: File, existingCount: number) => string | null
}).validateSlidePdf

function file(name: string, type: string, size = 100) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateSlidePdf', () => {
  it('accepts a named PDF while the Lab remains below its meeting limit', () => {
    expect(validateSlidePdf?.('Yang Li - immune adaptation', file('slides.pdf', 'application/pdf'), 19)).toBeNull()
  })

  it('requires a presenter or document name', () => {
    expect(validateSlidePdf?.('   ', file('slides.pdf', 'application/pdf'), 0)).toBe('Enter a presenter or document name.')
  })

  it('rejects non-PDF files', () => {
    expect(validateSlidePdf?.('Yang Li', file('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'), 0))
      .toBe('Please choose a PDF file.')
  })

  it('rejects files over 50 MB', () => {
    const oversized = new File([], 'slides.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversized, 'size', { value: MAX_SLIDES_SIZE + 1 })
    expect(validateSlidePdf?.('Yang Li', oversized, 0)).toBe('The PDF must be 50 MB or smaller.')
  })

  it('rejects a Lab that already has 20 slide PDFs for the meeting', () => {
    expect(validateSlidePdf?.('Yang Li', file('slides.pdf', 'application/pdf'), 20))
      .toBe('Each Lab can upload up to 20 slide PDFs for this meeting.')
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

describe('validateArchivePdfBatch', () => {
  it('accepts a PDF batch that stays within the Lab meeting limit', () => {
    expect(validateArchivePdfBatch([file('results.pdf', 'application/pdf'), file('appendix.PDF', 'application/pdf')], 18)).toBeNull()
  })

  it('rejects non-PDF files and batches above 20 files per Lab per meeting', () => {
    expect(validateArchivePdfBatch([file('slides.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')], 0))
      .toBe('Please choose PDF files only.')
    expect(validateArchivePdfBatch([file('one.pdf', 'application/pdf'), file('two.pdf', 'application/pdf')], 19))
      .toBe('Each Lab can store up to 20 PDFs for this meeting.')
  })
})

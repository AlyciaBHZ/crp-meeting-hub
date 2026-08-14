export const MAX_SLIDES_SIZE = 50 * 1024 * 1024
export const MAX_ARCHIVE_FILES_PER_LAB = 20

const allowedExtensions = new Set(['pdf', 'ppt', 'pptx'])

export function validateSlidesFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (!extension || !allowedExtensions.has(extension)) {
    return 'Please choose a PDF, PPT, or PPTX file.'
  }

  if (file.size > MAX_SLIDES_SIZE) {
    return 'The file must be 50 MB or smaller.'
  }

  return null
}

export function validateMinutesFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!extension || !new Set(['pdf', 'docx', 'md']).has(extension)) {
    return 'Please choose a PDF, DOCX, or Markdown file.'
  }
  if (file.size > MAX_SLIDES_SIZE) {
    return 'The file must be 50 MB or smaller.'
  }
  return null
}

export function validateArchivePdfBatch(files: File[], existingCount: number): string | null {
  if (!files.length) return 'Please choose at least one PDF file.'
  if (files.some((file) => file.name.split('.').pop()?.toLowerCase() !== 'pdf')) {
    return 'Please choose PDF files only.'
  }
  if (files.some((file) => file.size > MAX_SLIDES_SIZE)) {
    return 'Each file must be 50 MB or smaller.'
  }
  if (existingCount + files.length > MAX_ARCHIVE_FILES_PER_LAB) {
    return 'Each Lab can store up to 20 PDFs for this meeting.'
  }
  return null
}

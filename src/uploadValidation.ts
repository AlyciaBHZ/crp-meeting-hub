export const MAX_SLIDES_SIZE = 50 * 1024 * 1024

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

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('CRP Meeting Hub', () => {
  it('shows the upcoming meeting and supplied agenda', () => {
    const { container } = render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Upcoming meetings' })).toBeInTheDocument()
    expect(screen.getAllByText(/15 min presentation/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/5 min Q&A/).length).toBeGreaterThan(0)
    expect(screen.getByText("Prof Zhang Yang's group")).toBeInTheDocument()
    expect(screen.getByText("Prof Li Qi Jing's group")).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /upload slides for/i })).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Choose File' })).not.toBeInTheDocument()
    expect(container.querySelectorAll('input[type="file"]:not([hidden])')).toHaveLength(0)
  })

  it('shows minutes as pending until the administrator uploads them', () => {
    render(<App />)
    expect(screen.getByText('Meeting minutes')).toBeInTheDocument()
    expect(screen.getByText('Available after the meeting')).toBeInTheDocument()
  })

  it('shows the agenda in Singapore meeting time without shifting the supplied hours', () => {
    render(<App />)
    expect(screen.getAllByText('9:00 AM').length).toBeGreaterThan(0)
    expect(screen.getAllByText('11:00 AM').length).toBeGreaterThan(0)
  })
})

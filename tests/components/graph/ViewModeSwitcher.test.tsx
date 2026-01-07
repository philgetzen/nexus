import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewModeSwitcher } from '@/components/graph/ViewModeSwitcher'

describe('ViewModeSwitcher', () => {
  it('should render view mode switcher', () => {
    render(<ViewModeSwitcher viewMode="file" />)

    expect(screen.getByTestId('view-mode-switcher')).toBeInTheDocument()
  })

  it('should render both view mode options', () => {
    render(<ViewModeSwitcher viewMode="file" />)

    expect(screen.getByLabelText('File view')).toBeInTheDocument()
    expect(screen.getByLabelText('Symbol view')).toBeInTheDocument()
  })

  it('should display Files and Symbols labels', () => {
    render(<ViewModeSwitcher viewMode="file" />)

    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Symbols')).toBeInTheDocument()
  })

  it('should highlight file mode when selected', () => {
    render(<ViewModeSwitcher viewMode="file" />)

    const fileButton = screen.getByLabelText('File view')
    expect(fileButton).toHaveAttribute('aria-pressed', 'true')

    const symbolButton = screen.getByLabelText('Symbol view')
    expect(symbolButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('should highlight symbol mode when selected', () => {
    render(<ViewModeSwitcher viewMode="symbol" />)

    const symbolButton = screen.getByLabelText('Symbol view')
    expect(symbolButton).toHaveAttribute('aria-pressed', 'true')

    const fileButton = screen.getByLabelText('File view')
    expect(fileButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('should call onViewModeChange with file when file button is clicked', () => {
    const onViewModeChange = vi.fn()
    render(<ViewModeSwitcher viewMode="symbol" onViewModeChange={onViewModeChange} />)

    fireEvent.click(screen.getByLabelText('File view'))
    expect(onViewModeChange).toHaveBeenCalledWith('file')
  })

  it('should call onViewModeChange with symbol when symbol button is clicked', () => {
    const onViewModeChange = vi.fn()
    render(<ViewModeSwitcher viewMode="file" onViewModeChange={onViewModeChange} />)

    fireEvent.click(screen.getByLabelText('Symbol view'))
    expect(onViewModeChange).toHaveBeenCalledWith('symbol')
  })

  it('should work without onViewModeChange callback', () => {
    render(<ViewModeSwitcher viewMode="file" />)

    // Should not throw when clicking without handler
    fireEvent.click(screen.getByLabelText('Symbol view'))
  })
})

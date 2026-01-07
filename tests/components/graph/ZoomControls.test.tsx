import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ZoomControls } from '@/components/graph/ZoomControls'

describe('ZoomControls', () => {
  const defaultProps = {
    zoom: 100,
  }

  it('should render zoom controls', () => {
    render(<ZoomControls {...defaultProps} />)

    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument()
  })

  it('should display current zoom level', () => {
    render(<ZoomControls {...defaultProps} zoom={150} />)

    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('should round zoom level to integer', () => {
    render(<ZoomControls {...defaultProps} zoom={123.456} />)

    expect(screen.getByText('123%')).toBeInTheDocument()
  })

  it('should render zoom in button', () => {
    render(<ZoomControls {...defaultProps} />)

    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument()
  })

  it('should render zoom out button', () => {
    render(<ZoomControls {...defaultProps} />)

    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument()
  })

  it('should render fit to view button', () => {
    render(<ZoomControls {...defaultProps} />)

    expect(screen.getByLabelText('Fit to view')).toBeInTheDocument()
  })

  it('should call onZoomIn when zoom in button is clicked', () => {
    const onZoomIn = vi.fn()
    render(<ZoomControls {...defaultProps} onZoomIn={onZoomIn} />)

    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(onZoomIn).toHaveBeenCalledTimes(1)
  })

  it('should call onZoomOut when zoom out button is clicked', () => {
    const onZoomOut = vi.fn()
    render(<ZoomControls {...defaultProps} onZoomOut={onZoomOut} />)

    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(onZoomOut).toHaveBeenCalledTimes(1)
  })

  it('should call onFitToView when fit to view button is clicked', () => {
    const onFitToView = vi.fn()
    render(<ZoomControls {...defaultProps} onFitToView={onFitToView} />)

    fireEvent.click(screen.getByLabelText('Fit to view'))
    expect(onFitToView).toHaveBeenCalledTimes(1)
  })

  it('should work without callback props', () => {
    render(<ZoomControls {...defaultProps} />)

    // Should not throw when clicking without handlers
    fireEvent.click(screen.getByLabelText('Zoom in'))
    fireEvent.click(screen.getByLabelText('Zoom out'))
    fireEvent.click(screen.getByLabelText('Fit to view'))
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayoutSwitcher } from '@/components/graph/LayoutSwitcher'

describe('LayoutSwitcher', () => {
  it('should render layout switcher', () => {
    render(<LayoutSwitcher layout="force-directed" />)

    expect(screen.getByTestId('layout-switcher')).toBeInTheDocument()
  })

  it('should render all layout options', () => {
    render(<LayoutSwitcher layout="force-directed" />)

    expect(screen.getByLabelText('Force layout')).toBeInTheDocument()
    expect(screen.getByLabelText('Tree layout')).toBeInTheDocument()
    expect(screen.getByLabelText('Radial layout')).toBeInTheDocument()
  })

  it('should highlight force-directed when selected', () => {
    render(<LayoutSwitcher layout="force-directed" />)

    const forceButton = screen.getByLabelText('Force layout')
    expect(forceButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should highlight hierarchical when selected', () => {
    render(<LayoutSwitcher layout="hierarchical" />)

    const treeButton = screen.getByLabelText('Tree layout')
    expect(treeButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should highlight radial when selected', () => {
    render(<LayoutSwitcher layout="radial" />)

    const radialButton = screen.getByLabelText('Radial layout')
    expect(radialButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should call onLayoutChange with force-directed when force button is clicked', () => {
    const onLayoutChange = vi.fn()
    render(<LayoutSwitcher layout="hierarchical" onLayoutChange={onLayoutChange} />)

    fireEvent.click(screen.getByLabelText('Force layout'))
    expect(onLayoutChange).toHaveBeenCalledWith('force-directed')
  })

  it('should call onLayoutChange with hierarchical when tree button is clicked', () => {
    const onLayoutChange = vi.fn()
    render(<LayoutSwitcher layout="force-directed" onLayoutChange={onLayoutChange} />)

    fireEvent.click(screen.getByLabelText('Tree layout'))
    expect(onLayoutChange).toHaveBeenCalledWith('hierarchical')
  })

  it('should call onLayoutChange with radial when radial button is clicked', () => {
    const onLayoutChange = vi.fn()
    render(<LayoutSwitcher layout="force-directed" onLayoutChange={onLayoutChange} />)

    fireEvent.click(screen.getByLabelText('Radial layout'))
    expect(onLayoutChange).toHaveBeenCalledWith('radial')
  })

  it('should work without onLayoutChange callback', () => {
    render(<LayoutSwitcher layout="force-directed" />)

    // Should not throw when clicking without handler
    fireEvent.click(screen.getByLabelText('Tree layout'))
  })
})

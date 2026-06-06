// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import Rail from '@/components/feed/Rail'

afterEach(cleanup)

describe('Rail — four distinct states (Phase 3 WR-01 carry-forward)', () => {
  it('pending: renders a loading indicator (role=status), not error/empty/row', () => {
    render(<Rail title="Featured" status="pending" />)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByTestId('rail-loading')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('rail-empty')).toBeNull()
    expect(screen.queryByTestId('rail-row')).toBeNull()
  })

  it('error: renders role=alert with fixed generic copy, NO raw error string', () => {
    render(<Rail title="Featured" status="error" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeTruthy()
    expect(alert.textContent).toContain("Couldn't load Featured.")
    // No interpolated error detail leaks (T-04-03).
    expect(alert.textContent).not.toMatch(/error|stack|Error|exception/i)
    expect(screen.queryByTestId('rail-row')).toBeNull()
    expect(screen.queryByTestId('rail-empty')).toBeNull()
  })

  it('empty: success + isEmpty renders the empty block, distinct from error', () => {
    render(<Rail title="Featured" status="success" isEmpty />)
    expect(screen.getByTestId('rail-empty')).toBeTruthy()
    expect(screen.getByTestId('rail-empty').textContent).toContain(
      'No Featured yet.',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByTestId('rail-row')).toBeNull()
  })

  it('success with items: renders the child row', () => {
    render(
      <Rail title="Featured" status="success" isEmpty={false}>
        <div data-testid="child-item">item</div>
      </Rail>,
    )
    expect(screen.getByTestId('rail-row')).toBeTruthy()
    expect(screen.getByTestId('child-item')).toBeTruthy()
    expect(screen.queryByTestId('rail-empty')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('error and empty are not the same branch', () => {
    const { unmount } = render(<Rail title="Featured" status="error" />)
    const errorText = screen.getByRole('alert').textContent
    unmount()
    render(<Rail title="Featured" status="success" isEmpty />)
    const emptyText = screen.getByTestId('rail-empty').textContent
    expect(errorText).not.toBe(emptyText)
  })
})

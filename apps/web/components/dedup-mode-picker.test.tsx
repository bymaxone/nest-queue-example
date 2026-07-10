/**
 * @fileoverview Unit tests for the deduplication-mode picker.
 * @layer components/dedup-mode-picker.test
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DedupModePicker } from './dedup-mode-picker'

describe('DedupModePicker', () => {
  it('renders all four deduplication modes', () => {
    // Scenario: the picker must offer every mode the reindex lab supports.
    render(<DedupModePicker value="simple" onChange={vi.fn()} />)
    for (const mode of ['simple', 'throttle', 'debounce', 'keepLast']) {
      expect(screen.getByText(mode)).toBeInTheDocument()
    }
  })

  it('marks the selected mode as checked', () => {
    // Scenario: the radiogroup semantics must reflect the current value.
    render(<DedupModePicker value="throttle" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /throttle/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /simple/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onChange with the clicked mode', async () => {
    // Scenario: clicking an unselected pill must report that mode upward.
    const onChange = vi.fn()
    render(<DedupModePicker value="simple" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /debounce/i }))
    expect(onChange).toHaveBeenCalledWith('debounce')
  })
})

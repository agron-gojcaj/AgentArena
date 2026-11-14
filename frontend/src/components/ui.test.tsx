import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorMessage, Status } from './ui';
it('makes API errors available to assistive technology', () => {
  render(<ErrorMessage error={new Error('Budget exceeded')} />);
  expect(screen.getByRole('alert')).toHaveTextContent('Budget exceeded');
});
it('displays policy failure as text as well as color', () => {
  render(<Status value="POLICY_FAILED" />);
  expect(screen.getByText('POLICY FAILED')).toBeInTheDocument();
});

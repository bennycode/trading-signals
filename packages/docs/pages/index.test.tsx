import {render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import Home from './index';

describe('Home Page', () => {
  it('renders all category cards', () => {
    render(<Home />);
    expect(screen.getByText('Trend Indicators')).toBeInTheDocument();
    expect(screen.getByText('Momentum Indicators')).toBeInTheDocument();
    expect(screen.getByText('Volatility Indicators')).toBeInTheDocument();
    expect(screen.getByText('Utility Functions')).toBeInTheDocument();
  });
});

# Interactive Demo Pages for Trading Signals

This directory contains interactive demo pages that showcase technical indicators with examples and visualizations.

## Features

- **Sidebar Navigation**: Browse all technical indicators organized by category (Trend, Momentum, Volatility, Exhaustion)
- **Interactive Examples**: View sample input data and calculated indicator values in clear data tables
- **Data Visualization**: Charts showing both input data and indicator outputs using Highcharts
- **Educational Content**: Interpretation guidelines and practical usage tips for each indicator

## Structure

- `index.html` - Main demo homepage with sidebar navigation
- Individual indicator pages (e.g., `sma.html`, `rsi.html`, `bbands.html`)
- Sample implementations for key indicators across different categories

## Currently Implemented Indicators

### Trend Indicators
- ✅ SMA (Simple Moving Average) - Complete with data table and chart

### Momentum Indicators  
- ✅ RSI (Relative Strength Index) - Complete with overbought/oversold signals

### Volatility Indicators
- ✅ BBANDS (Bollinger Bands) - Complete with band visualization

### All Other Indicators
- 📋 Navigation structure ready for all 35+ indicators
- 🚧 Individual pages can be generated using the template system

## Technical Implementation

- Pure HTML/CSS/JavaScript - no build system dependencies
- Responsive design using CSS Grid and Flexbox
- Highcharts integration for data visualization
- Modular template system for generating individual indicator pages
- Sample data calculations using simplified JavaScript implementations

## Usage

1. Open `docs/demo/index.html` in a web browser
2. Navigate through indicators using the sidebar
3. View data tables showing input/output values similar to TulipIndicators.org
4. Explore interactive charts with price data and indicator overlays

## Development

The demo pages are designed to be:
- Self-contained and portable
- Easy to extend with new indicators
- Educational and practical for traders and developers
- Consistent with the existing documentation theme

This serves as both documentation and an educational tool for understanding how technical indicators process data and generate trading signals.
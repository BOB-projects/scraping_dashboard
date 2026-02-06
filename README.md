# Bina.az Market Dashboard

This project provides a comparative dashboard for real estate market analysis using data scraped from bina.az.

## Features
- **Comparative Analysis**: Compare prices across different months.
- **Regional Analysis**: Price per m² and Total Price breakdown by Baku regions.
- **Room Count Analysis**: Trends based on number of rooms.
- **Category Analysis**: Market segmentation by property type (excluding outliers).
- **Interactive Slicers**: Filter by Rent/Sale and Time Period.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the dashboard:
   ```bash
   streamlit run app.py
   ```

## Data Structure
The dashboard expects data in the `data/bina_az/data/` directory with filenames containing the date (YYYYMM), e.g., `bina_sale_202601.csv`.

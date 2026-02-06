import streamlit as st
import pandas as pd
import plotly.express as px
import os
import glob
import re

st.set_page_config(page_title="Bina.az Market Dashboard", layout="wide")

st.title("🏡 Bina.az Real Estate Market Dashboard")

# --- Data Loading ---
@st.cache_data
def load_data():
    base_path = "data/bina_az/data"
    all_files = []
    
    # Walk through the directory to find csv files
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(".csv") and "bina_" in file:
                full_path = os.path.join(root, file)
                is_rent = "rent" in full_path.lower() or "rent" in file.lower()
                op_type = "Rent" if is_rent else "Sale"
                match = re.search(r'(\d{6})', file)
                date_period = f"{match.group(1)[:4]}-{match.group(1)[4:]}" if match else "Unknown"
                
                all_files.append({"path": full_path, "type": op_type, "period": date_period})
    
    data_frames = []
    # Read only necessary columns and filter early to save memory/time
    cols = ['price_value', 'area_value', 'area_units', 'rooms', 'category', 'city_name', 'location_name']
    
    for f in all_files:
        try:
            # use pyarrow engine for 10x speed on large CSVs
            df = pd.read_csv(f['path'], usecols=cols, engine='pyarrow')
            
            # Filter for Baku only immediately to reduce memory churn
            df = df[df['city_name'] == 'Bakı'].copy()
            df.drop(columns=['city_name'], inplace=True)
            
            # Fill missing locations to avoid dropping them in the region filter
            df['location_name'] = df['location_name'].fillna('Naməlum')
            
            df['operation_type'] = f['type']
            df['period'] = f['period']
            
            # Handle Units (1 sot = 100 m2)
            # We want everything in m2 for consistency
            df.loc[df['area_units'] == 'sot', 'area_value'] = df['area_value'] * 100
            
            # Downcast numeric types to save memory
            df['price_value'] = df['price_value'].astype('float32')
            df['area_value'] = df['area_value'].astype('float32')
            df['rooms'] = df['rooms'].astype('float32')
            
            data_frames.append(df)
        except Exception as e:
            st.error(f"Error reading {f['path']}: {e}")
            
    if not data_frames:
        return pd.DataFrame()
        
    final_df = pd.concat(data_frames, ignore_index=True)
    
    # Convert string columns to categories (MUCH faster for grouping and smaller memory footprint)
    cat_cols = ['category', 'location_name', 'operation_type', 'period']
    for col in cat_cols:
        final_df[col] = final_df[col].astype('category')
    
    # Calculate Price per m2 (Float32 is enough precision)
    final_df['price_per_m2'] = final_df['price_value'] / final_df['area_value']
    
    # Remove outliers (99th percentile)
    upper_limit = final_df['price_per_m2'].quantile(0.99)
    final_df = final_df[final_df['price_per_m2'] < upper_limit]
    
    return final_df

try:
    df = load_data()
except Exception as e:
    st.error(f"Failed to load data: {e}")
    st.stop()

if df.empty:
    st.warning("No data found. Check your data directory.")
    st.stop()

# --- Slicers ---
st.sidebar.header("Filters")

# Operation Type
op_types = df['operation_type'].unique().tolist()
selected_op = st.sidebar.selectbox("Operation Type", op_types, index=0)

filtered_df = df[df['operation_type'] == selected_op]

# Month Selection (Comparison)
available_periods = sorted(filtered_df['period'].unique().tolist())
selected_periods = st.sidebar.multiselect("Select Months to Compare", available_periods, default=available_periods)

if not selected_periods:
    st.warning("Please select at least one month.")
    st.stop()

filtered_df = filtered_df[filtered_df['period'].isin(selected_periods)]

# --- Ad Count Filter ---
min_ads = st.sidebar.slider("Minimum Ads per Region", min_value=1, max_value=1000, value=50)

# --- Region Selection ---
all_regions = sorted(filtered_df['location_name'].unique().tolist())

with st.sidebar.expander("🌍 Select Regions", expanded=True):
    select_all = st.checkbox("Select All Regions", value=False)
    if select_all:
        selected_regions = st.multiselect("Regions", all_regions, default=all_regions)
    else:
        # Get top 10 regions by ad count to show as default
        top_10_by_ads = filtered_df['location_name'].value_counts().head(10).index.tolist()
        
        # Sort these for the multiselect default
        default_regions = sorted(top_10_by_ads)
        
        selected_regions = st.multiselect("Regions", all_regions, default=default_regions)

if not selected_regions:
    st.warning("Please select at least one region.")
    st.stop()

filtered_df = filtered_df[filtered_df['location_name'].isin(selected_regions)]

# --- Export Section ---
st.sidebar.divider()
st.sidebar.subheader("📥 Export Data")

@st.cache_data
def convert_df(df):
    # Convert to CSV (Excel with multiple sheets is heavier to process in browser)
    return df.to_csv(index=False).encode('utf-8')

csv = convert_df(filtered_df)
st.sidebar.download_button(
    label="Download Filtered Data (CSV)",
    data=csv,
    file_name=f"bina_az_{selected_op.lower()}_{pd.Timestamp.now().strftime('%Y%m%d')}.csv",
    mime='text/csv',
)

# --- Main Dashboard ---

# 1. Comparative Analysis (Price per m2) by Region
st.header(f"📍 Comparative Price Analysis ({selected_op})")

# Aggregation by Region and Period
region_stats = filtered_df.groupby(['location_name', 'period'], observed=True).agg(
    avg_price_m2=('price_per_m2', 'median'),
    avg_price=('price_value', 'median'),
    count=('price_value', 'count')
).reset_index()

# Filter by Ad Count (Remove low-volume regions)
region_stats = region_stats[region_stats['count'] >= min_ads]

# Sort for horizontal chart
top_regions = region_stats.groupby('location_name', observed=True)['avg_price_m2'].median().sort_values(ascending=True).index
region_stats['location_name'] = pd.Categorical(region_stats['location_name'], categories=top_regions, ordered=True)
region_stats = region_stats.sort_values('location_name')

# Dynamic height for better readability of many regions
chart_height = max(500, len(region_stats['location_name'].unique()) * 25 + 100)

# Chart 1: Price per m2 (Horizontal)
fig_m2 = px.bar(
    region_stats, 
    y='location_name', 
    x='avg_price_m2', 
    color='period', 
    barmode='group',
    orientation='h',
    title="Median Price per m² by Region (Baku)",
    labels={'avg_price_m2': 'Median Price per m² (AZN)', 'location_name': 'Region', 'count': 'Number of Ads'},
    hover_data={'count': True},
    height=chart_height
)
st.plotly_chart(fig_m2, width="stretch")

# Chart 2: Total Price (Horizontal)
st.subheader("General Price Overview")
fig_price = px.bar(
    region_stats, 
    y='location_name', 
    x='avg_price', 
    color='period', 
    barmode='group',
    orientation='h',
    title="Median Total Price by Region (Baku)",
    labels={'avg_price': 'Median Total Price (AZN)', 'location_name': 'Region', 'count': 'Number of Ads'},
    hover_data={'count': True},
    height=chart_height
)
st.plotly_chart(fig_price, width="stretch")


# 2. Room Count Analysis
st.header("🏠 Analysis by Room Count")

# Filter crazy room counts if any (optional)
filtered_df = filtered_df[filtered_df['rooms'] <= 10] 

room_stats = filtered_df.groupby(['rooms', 'period'], observed=True).agg(
    avg_price_m2=('price_per_m2', 'median'),
    count=('price_value', 'count')
).reset_index()

fig_rooms = px.line(
    room_stats, 
    x='rooms', 
    y='avg_price_m2', 
    color='period', 
    markers=True,
    title="Median Price per m² vs Room Count",
    labels={'avg_price_m2': 'Median Price per m² (AZN)', 'rooms': 'Number of Rooms', 'count': 'Number of Ads'},
    hover_data={'count': True}
)
st.plotly_chart(fig_rooms, width="stretch")


# 3. Category Analysis
st.header("🏢 Category Analysis")

# Filter out low-volume categories (< 1% of total data)
category_counts = filtered_df['category'].value_counts(normalize=True)
top_categories = category_counts[category_counts > 0.01].index

cat_df = filtered_df[filtered_df['category'].isin(top_categories)].copy()
# Explicitly remove unused categories from the categorical type to fix the empty bars in plot
cat_df['category'] = cat_df['category'].cat.remove_unused_categories()

cat_stats = cat_df.groupby(['category', 'period'], observed=True).agg(
    avg_price_m2=('price_per_m2', 'median'),
    count=('price_value', 'count')
).reset_index()

# Sort categories by price descending for better vertical display
cat_order = cat_stats.groupby('category', observed=True)['avg_price_m2'].median().sort_values(ascending=False).index
cat_stats['category'] = pd.Categorical(cat_stats['category'], categories=cat_order, ordered=True)
cat_stats = cat_stats.sort_values('category')

fig_cat = px.bar(
    cat_stats, 
    x='category', 
    y='avg_price_m2', 
    color='period',
    barmode='group', 
    title="Median Price per m² by Property Category",
    labels={'avg_price_m2': 'Median Price per m² (AZN)', 'category': 'Category', 'count': 'Number of Ads'},
    hover_data={'count': True},
    height=500
)
st.plotly_chart(fig_cat, width="stretch")

st.divider()
st.write("Data Source: Internal Scraping Projects (Bina.az)")

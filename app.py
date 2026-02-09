import streamlit as st
import pandas as pd
import plotly.express as px
import os
import re
import io

st.set_page_config(page_title="Market Comparison Dashboard", layout="wide")

# --- URL State Persistence Helpers ---
def _qp_get():
    try:
        qp = st.query_params
        return {k: qp.get_all(k) for k in qp.keys()}
    except Exception:
        return {}

def _qp_set(params):
    try:
        qp = st.query_params
        # Normalize desired params to dict[str, list[str]]
        desired = {}
        for k, v in params.items():
            if v is None:
                continue
            if isinstance(v, (list, tuple)):
                desired[k] = [str(x) for x in v if x is not None]
            else:
                desired[k] = [str(v)]

        # Normalize current params to dict[str, list[str]]
        current = {}
        for k in qp.keys():
            current[k] = [str(x) for x in qp.get_all(k)]

        if current == desired:
            return

        qp.clear()
        for k, vals in desired.items():
            qp[k] = vals
    except Exception:
        pass

def _qp_get_value(qp, key, default=None):
    if key not in qp:
        return default
    val = qp.get(key)
    if isinstance(val, list):
        return val[0] if val else default
    return val

def _qp_get_list(qp, key, default=None):
    raw = _qp_get_value(qp, key, None)
    if raw is None:
        return default
    if isinstance(raw, list):
        return raw
    return [v for v in str(raw).split(",") if v != ""]

def _qp_get_int(qp, key, default=None):
    raw = _qp_get_value(qp, key, None)
    if raw is None:
        return default
    try:
        return int(float(raw))
    except Exception:
        return default

def _qp_get_range(qp, key, default=None, as_int=False):
    raw = _qp_get_value(qp, key, None)
    if raw is None:
        return default
    try:
        a, b = str(raw).split(",")
        if as_int:
            return (int(float(a)), int(float(b)))
        return (float(a), float(b))
    except Exception:
        return default

def _qp_set_param(params, key, value):
    if value is None:
        return
    if isinstance(value, (list, tuple)):
        params[key] = [str(v) for v in value]
    else:
        params[key] = str(value)

# --- Translations ---
TRANSLATIONS = {
    "en": {
        "select_platform": "Select Platform",
        "marketplace": "Marketplace",
        "market_analysis": "Market Analysis",
        "language": "Language",
        "time_type": "Time & Type",
        "op_type": "Operation Type",
        "select_months": "Select Months",
        "location": "Location",
        "min_ads_region": "Min Ads per Region",
        "selection_mode": "Selection Mode",
        "all_regions": "All Regions",
        "top_10": "Top 10",
        "top_20": "Top 20",
        "custom": "Custom",
        "select_regions": "Select Regions",
        "warning_region": "Please select at least one region",
        "prop_details": "Property Details",
        "room_count": "Room Count",
        "category": "Category",
        "prop_category": "Property Category",
        "showing_listings": "Showing {:,} listings",
        "showing_ads": "Showing {:,} ads",
        "total_listings": "Total Listings",
        "total_ads": "Total Ads",
        "median_rent": "Median Rent",
        "median_price_m2": "Median Price/m²",
        "median_total": "Median Total Price",
        "avg_rooms": "Avg Rooms",
        "avg_area": "Avg Area",
        "med_price": "Median Price",
        "avg_year": "Avg Year",
        "avg_mileage": "Avg Mileage",
        "filter_time": "Time Period",
        "filter_car": "Car Selection",
        "filter_price": "Price & Condition",
        "filter_specs": "Technical Specs",
        "min_ads_brand": "Min Ads per Brand",
        "select_brands": "Select Brands",
        "select_all": "Select All",
        "select_all_brands": "Select All Brands",
        "brands": "Brands",
        "price_range": "Price Range",
        "year_range": "Year Range",
        "max_mileage": "Max Mileage",
        "fuel_type": "Fuel Type",
        "transmission": "Transmission",
        "body_type": "Body Type",
        "select_all_fuel": "Select All Fuel Types",
        "select_all_trans": "Select All Transmissions",
        "select_all_bodies": "Select All Body Types",
        "export": "📥 Export Data",
        "download_csv": "Download CSV",
        "download_excel": "Download Excel",
        "markets": "Markets",
        "products": "Products",
        "avg_discount": "Avg Discount",
        "discounted_items": "Discounted Items",
        "max_discount": "Max Discount",
        "all_brands_placeholder": "All Brands",
        "reg_analysis": "📍 Regional Analysis",
        "market_trends": "📈 Market Trends",
        "prop_details_tab": "🏠 Property Details",
        "price_movement": "Price Movement Over Time",
        "price_vs_area": "📏 Price vs Area",
        "dist_total_price": "Distribution of Total Price",
        "dist_price_m2": "Distribution of Price per m²",
        "rooms_analysis": "🏠 Rooms Analysis",
        "cat_breakdown": "Category Breakdown",
        "brand_price": "📉 Brand & Price",
        "tech_specs": "⚙️ Technical Specs",
        "age_trends": "⏳ Age & Trends",
        "brand_market_overview": "Brand Market Overview",
        "body_type_analysis": "Body Type Analysis",
        "engine_fuel": "Engine & Fuel Insights",
        "depreciation": "Depreciation Trends",
        "price_by_year": "Price by Year Bucket",
        "price_vs_mileage": "Price vs Mileage (Bucket: 50k km)",
        "cat_analysis": "📊 Category Analysis",
        "brand_overview": "🏷️ Brand Overview",
        "price_count_cat": "Price & Count by Category",
        "num_products_cat": "Number of Products per Category",
        "price_dist_cat": "Price Distribution by Category",
        "top_brands_presence": "Top Brands by Presence",
        "top_20_brands": "Top 20 Brands by Product Count",
        "Sale": "Sale",
        "Rent": "Rent"
    },
    "az": {
        "select_platform": "Platforma Seçin",
        "marketplace": "Bazar",
        "market_analysis": "Bazar Təhlili",
        "language": "Dil",
        "time_type": "📅 Zaman və Növ",
        "op_type": "Əməliyyat Növü",
        "select_months": "Ayları Seçin",
        "location": "🌍 Məkan",
        "min_ads_region": "Region üzrə Min Elan",
        "selection_mode": "Seçim Rejimi",
        "all_regions": "Bütün Regionlar",
        "top_10": "İlk 10",
        "top_20": "İlk 20",
        "custom": "Xüsusi",
        "select_regions": "Regionları Seçin",
        "warning_region": "Ən azı bir region seçin",
        "prop_details": "🏠 Əmlak Təfərrüatları",
        "room_count": "Otaq Sayı",
        "category": "Kateqoriya",
        "prop_category": "Əmlak Kateqoriyası",
        "showing_listings": "{:,} elan göstərilir",
        "showing_ads": "{:,} elan göstərilir",
        "total_listings": "Toplam Elanlar",
        "total_ads": "Toplam Elanlar",
        "median_rent": "Orta Kirayə",
        "median_price_m2": "Orta Qiymət/m²",
        "median_total": "Orta Ümumi Qiymət",
        "avg_rooms": "Ort. Otaqlar",
        "avg_area": "Ort. Sahə",
        "med_price": "Orta Qiymət",
        "avg_year": "Ort. İl",
        "avg_mileage": "Ort. Yürüş",
        "filter_time": "Zaman Dövrü",
        "filter_car": "Avtomobil Seçimi",
        "filter_price": "Qiymət və Vəziyyət",
        "filter_specs": "⚙️ Texniki Xüsusiyyətlər",
        "min_ads_brand": "Brend üzrə Min Elan",
        "select_brands": "Brendləri Seçin",
        "select_all": "Hər birini seç",
        "select_all_brands": "Bütün Brendləri Seçin",
        "brands": "Brendlər",
        "price_range": "Qiymət Aralığı",
        "year_range": "İl Aralığı",
        "max_mileage": "Maks Yürüş",
        "fuel_type": "Yanacaq Növü",
        "transmission": "Sürətlər Qutusu",
        "body_type": "Ban Növü",
        "select_all_fuel": "Bütün Yanacaq Növləri",
        "select_all_trans": "Bütün Sürətlər Qutuları",
        "select_all_bodies": "Bütün Ban Növləri",
        "export": "📥 Məlumatı Yüklə",
        "download_csv": "CSV Yüklə",
        "download_excel": "Excel Yüklə",
        "markets": "Marketlər",
        "products": "Məhsullar",
        "avg_discount": "Ort. Endirim",
        "discounted_items": "Endirimli Məhsullar",
        "max_discount": "Maks Endirim",
        "all_brands_placeholder": "Bütün Brendlər",
        "reg_analysis": "📍 Regional Təhlil",
        "market_trends": "📈 Bazar Trendləri",
        "prop_details_tab": "🏠 Əmlak Təfərrüatları",
        "price_movement": "Zamanla Qiymət Dəyişimi",
        "price_vs_area": "📏 Qiymət vs Sahə",
        "dist_total_price": "Ümumi Qiymət Paylanması",
        "dist_price_m2": "Qiymət/m² Paylanması",
        "rooms_analysis": "🏠 Otaq Təhlili",
        "cat_breakdown": "Kateqoriya Bölgüsü",
        "brand_price": "📉 Brend və Qiymət",
        "tech_specs": "⚙️ Texniki Göstəricilər",
        "age_trends": "⏳ Yaş və Trendlər",
        "brand_market_overview": "Brend Bazar İcmalı",
        "body_type_analysis": "Ban Növü Təhlili",
        "engine_fuel": "Mühərrik və Yanacaq",
        "depreciation": "Amortizasiya Trendləri",
        "price_by_year": "İl Aralığına Görə Qiymət",
        "price_vs_mileage": "Qiymət vs Yürüş (50k km aralıqla)",
        "cat_analysis": "📊 Kateqoriya Təhlili",
        "brand_overview": "🏷️ Brend İcmalı",
        "price_count_cat": "Kateqoriya üzrə Qiymət və Say",
        "num_products_cat": "Kateqoriya üzrə Məhsul Sayı",
        "price_dist_cat": "Kateqoriya üzrə Qiymət Paylanması",
        "top_brands_presence": "Sayına görə Ən Böyük Brendlər",
        "top_20_brands": "Məhsul Sayına görə İlk 20 Brend",
        "Sale": "Satış",
        "Rent": "Kirayə"
    }
}

# --- Custom CSS for Modern Look ---
st.markdown("""
    <style>
        .block-container {padding-top: 1rem; padding-bottom: 2rem;}
        div[data-testid="stMetric"] {
            background-color: rgba(240, 242, 246, 0.05);
            border: 1px solid rgba(240, 242, 246, 0.1);
            padding: 15px;
            border-radius: 10px;
        }
        [data-testid="stMetricLabel"] {
            color: #808495 !important;
            font-weight: 600 !important;
        }
        [data-testid="stMetricValue"] {
            color: #ffffff !important;
        }
        h1, h2, h3 {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
    </style>
""", unsafe_allow_html=True)


# --- Language & Project Selection ---
qp = _qp_get()
filtered_df = pd.DataFrame() # Global placeholder for exports

# Clear state logic moved to a callback for reliability and speed
def on_project_change():
    # Only clear if it actually changed to avoid loop
    if "current_view" in st.session_state and st.session_state.current_view != st.session_state.proj_sel:
        st_lang = st.session_state.get('lang', 'en')
        st_lc = st.session_state.get('lang_choice', 'English')
        new_proj = st.session_state.proj_sel
        
        # Clear filters to avoid collisions between projects
        for k in list(st.session_state.keys()):
            if k not in ['lang', 'lang_choice']:
                del st.session_state[k]
        
        st.session_state.current_view = new_proj
        st.session_state.lang = st_lang
        st.session_state.lang_choice = st_lc

if 'lang' not in st.session_state:
    qp_lang = _qp_get_value(qp, "lang", "en")
    st.session_state.lang = qp_lang if qp_lang in ["en", "az"] else "en"

def t(key):
    return TRANSLATIONS[st.session_state.lang].get(key, key)

with st.sidebar:
    # Language Selector
    lang_choice = st.selectbox(
        "🌐 " + t('language'),
        options=["English", "Azərbaycanca"],
        index=0 if st.session_state.lang == 'en' else 1,
        label_visibility="visible",
        key="lang_choice"
    )
    st.session_state.lang = 'en' if lang_choice == "English" else 'az'
    
    st.divider()
    st.markdown(f"### 🎯 {t('marketplace')}")
    
    # Get current project from URL or default
    if "current_view" not in st.session_state:
        qp_project = _qp_get_value(qp, "project", "Bina.az")
        st.session_state.current_view = qp_project if qp_project in ["Bina.az", "Turbo.az", "Markets"] else "Bina.az"

    pref_idx = 0
    if st.session_state.current_view == "Turbo.az":
        pref_idx = 1
    elif st.session_state.current_view == "Markets":
        pref_idx = 2
    
    project = st.radio(
        t('select_platform'), 
        ["Bina.az", "Turbo.az", "Markets"], 
        index=pref_idx,
        horizontal=True,
        key="proj_sel",
        on_change=on_project_change
    )
    # Ensure project variable is synced with state
    project = st.session_state.proj_sel if "proj_sel" in st.session_state else st.session_state.current_view
    st.divider()

st.title(f"📊 {t(project.lower()) if project == 'Markets' else project} {t('market_analysis')}")

# --- Data Loading Functions ---

@st.cache_data
def load_bina_data():
    base_path = "data/bina_az/data"
    all_files = []
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
            df.loc[df['area_units'] == 'sot', 'area_value'] = df['area_value'] * 100
            
            # Downcast numeric types to save memory
            df['price_value'] = df['price_value'].astype('float32')
            df['area_value'] = df['area_value'].astype('float32')
            # Treat 0 rooms as missing (invalid in listings)
            df['rooms'] = pd.to_numeric(df['rooms'], errors='coerce')
            df.loc[df['rooms'] == 0, 'rooms'] = pd.NA
            df['rooms'] = df['rooms'].astype('float32')
            
            data_frames.append(df)
        except Exception as e:
            st.error(f"Error reading {f['path']}: {e}")
            
    if not data_frames:
        return pd.DataFrame()
    final_df = pd.concat(data_frames, ignore_index=True)
    
    # Convert string columns to categories
    cat_cols = ['category', 'location_name', 'operation_type', 'period']
    for col in cat_cols:
        final_df[col] = final_df[col].astype('category')
    
    # Calculate Price per m2
    final_df['price_per_m2'] = final_df['price_value'] / final_df['area_value']
    
    # Remove outliers (99th percentile)
    upper_limit = final_df['price_per_m2'].quantile(0.99)
    final_df = final_df[final_df['price_per_m2'] < upper_limit]
    
    return final_df

@st.cache_data
def load_markets_data():
    base_path = "data/markets/data"
    all_files = []
    if not os.path.exists(base_path):
        return pd.DataFrame()
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(".csv"):
                all_files.append(os.path.join(root, file))
    
    data_frames = []
    for f in all_files:
        try:
            df = pd.read_csv(f)
            if 'timestamp' in df.columns:
                df['date'] = pd.to_datetime(df['timestamp'], errors='coerce')
                # Create YYYY-MM period
                df['period'] = df['date'].dt.to_period('M').astype(str)
            else:
                # Fallback if no timestamp, try to parse from filename or default
                df['period'] = "Unknown"
            
            data_frames.append(df)
        except Exception:
            continue
            
    if not data_frames:
        return pd.DataFrame()
    final_df = pd.concat(data_frames, ignore_index=True)
    
    # Ensure specific types
    if 'category' in final_df.columns:
        final_df['category'] = final_df['category'].astype('category')
    if 'brand' in final_df.columns:
        final_df['brand'] = final_df['brand'].astype('category')
        
    return final_df

@st.cache_data
def load_turbo_data():
    base_path = "data/turbo_az/data"
    all_files = []
    if not os.path.exists(base_path):
        return pd.DataFrame()
    for file in os.listdir(base_path):
        if file.endswith(".csv"):
            full_path = os.path.join(base_path, file)
            match = re.search(r'(\d{4}-\d{2})', file)
            date_period = match.group(1) if match else "Unknown"
            all_files.append({"path": full_path, "period": date_period})
    
    data_frames = []
    # Only load essential columns to save memory and time
    cols = ['brand', 'model', 'price', 'year', 'engine', 'mileage', 'location', 
            'detail_body_type', 'detail_transmission', 'detail_engine']
    
    def bucket_year(y):
        if y < 1990:
            return "< 1990"
        if 1990 <= y <= 1995:
            return "1990-1995"
        if 1996 <= y <= 2000:
            return "1996-2000"
        if 2001 <= y <= 2005:
            return "2001-2005"
        if 2006 <= y <= 2010:
            return "2006-2010"
        if 2011 <= y <= 2015:
            return "2011-2015"
        if 2016 <= y <= 2019:
            return "2016-2019"
        if 2020 <= y <= 2026:
            return "2020-2026"
        return "Other"

    for f in all_files:
        try:
            # Use pyarrow for extreme speed
            df = pd.read_csv(f['path'], usecols=cols, engine='pyarrow')
            
            # Fast vectorized string cleaning
            if 'price' in df.columns:
                # Remove currency and spaces in one go
                df['price_value'] = df['price'].str.replace('₼', '', regex=False).str.replace(' ', '', regex=False).str.replace('$', '', regex=False).str.replace('€', '', regex=False)
                df['price_value'] = pd.to_numeric(df['price_value'], errors='coerce')
                df.dropna(subset=['price_value'], inplace=True)
            
            if 'mileage' in df.columns:
                df['mileage_value'] = df['mileage'].str.replace('km', '', regex=False).str.replace(' ', '', regex=False)
                df['mileage_value'] = pd.to_numeric(df['mileage_value'], errors='coerce')
            
            if 'engine' in df.columns:
                # Extract first word (the volume)
                df['engine_vol'] = df['engine'].str.split(' ').str[0].astype('float32')
            
            if 'detail_engine' in df.columns:
                # Extract fuel from "1.4 L / 180 a.g. / Benzin"
                # Use split with expand=True for speed
                parts = df['detail_engine'].str.split(' / ', expand=True)
                if parts.shape[1] >= 3:
                    df['fuel_type'] = parts[2].str.strip()
                else:
                    df['fuel_type'] = "Petrol" # Fallback
            
            df['period'] = f['period']
            df['year'] = pd.to_numeric(df['year'], errors='coerce')
            df.dropna(subset=['year'], inplace=True)
            df['year_bucket'] = df['year'].apply(bucket_year)
            
            data_frames.append(df)
        except Exception:
            continue
            
    if not data_frames:
        return pd.DataFrame()
    final_df = pd.concat(data_frames, ignore_index=True)

    # Category conversions after concat for efficiency
    cat_cols = ['brand', 'model', 'location', 'detail_body_type', 'detail_transmission', 'fuel_type', 'period', 'year_bucket']
    for c in cat_cols:
        if c in final_df.columns:
            final_df[c] = final_df[c].astype('category')

    return final_df

# --- Load Selected Project Data ---
if project == "Bina.az":
    try:
        df = load_bina_data()
    except Exception as e:
        st.error(f"Failed to load data: {e}")
        st.stop()

    if df.empty:
        st.warning("No data found. Check your data directory.")
        st.stop()

    # Bina.az Slicers
    with st.sidebar:
        with st.expander("📅 " + t('time_type'), expanded=True):
            op_types = df['operation_type'].unique().tolist()
            if "op_type" not in st.session_state:
                qp_op = _qp_get_value(qp, "op", op_types[0] if op_types else None)
                st.session_state.op_type = qp_op if qp_op in op_types else (op_types[0] if op_types else None)
            selected_op = st.selectbox(t('op_type'), op_types, format_func=lambda x: t(x), key="op_type")
            filtered_df = df[df['operation_type'] == selected_op]

            available_periods = sorted(filtered_df['period'].unique().tolist())
            if "periods" not in st.session_state:
                qp_periods = _qp_get_list(qp, "periods", available_periods)
                st.session_state.periods = [p for p in qp_periods if p in available_periods] or available_periods
            selected_periods = st.multiselect(t('select_months'), available_periods, key="periods")
            if not selected_periods:
                st.stop()
            filtered_df = filtered_df[filtered_df['period'].isin(selected_periods)]

        with st.expander("📍 " + t('location'), expanded=True):
            if "min_ads_region" not in st.session_state:
                st.session_state.min_ads_region = _qp_get_int(qp, "min_ads_region", 50)
            min_ads = st.slider(t('min_ads_region'), 1, 1000, key="min_ads_region")
            
            all_regions = sorted(filtered_df['location_name'].unique().tolist())
            reg_options = [t('all_regions'), t('top_10'), t('top_20'), t('custom')]
            if "reg_mode" not in st.session_state:
                qp_reg = _qp_get_value(qp, "reg_mode", reg_options[0])
                st.session_state.reg_mode = qp_reg if qp_reg in reg_options else reg_options[0]
            reg_mode = st.radio(t('selection_mode'), reg_options, horizontal=True, label_visibility="collapsed", key="reg_mode")
            
            if reg_mode == t('all_regions'):
                selected_regions = all_regions
            elif reg_mode == t('top_10'):
                selected_regions = filtered_df['location_name'].value_counts().head(10).index.tolist()
            elif reg_mode == t('top_20'):
                selected_regions = filtered_df['location_name'].value_counts().head(20).index.tolist()
            else:
                if "regions" not in st.session_state:
                    qp_regions = _qp_get_list(qp, "regions", all_regions[:5])
                    st.session_state.regions = [r for r in qp_regions if r in all_regions] or all_regions[:5]
                selected_regions = st.multiselect(t('select_regions'), all_regions, key="regions")
                
            if not selected_regions:
                st.warning(t('warning_region'))
                st.stop()
            filtered_df = filtered_df[filtered_df['location_name'].isin(selected_regions)]

        with st.expander("🏠 " + t('prop_details'), expanded=True):
            # Room Count with Pills for better visuals
            all_rooms_available = sorted([int(r) for r in filtered_df['rooms'].dropna().unique().tolist()])
            # keep only reasonable room counts for the pills
            pill_rooms = [r for r in all_rooms_available if r <= 5]
            
            st.write(t('room_count'))
            if "rooms" not in st.session_state:
                qp_rooms = _qp_get_list(qp, "rooms", pill_rooms)
                qp_rooms_int = []
                for r in qp_rooms:
                    try:
                        qp_rooms_int.append(int(float(r)))
                    except Exception:
                        pass
                st.session_state.rooms = [r for r in qp_rooms_int if r in pill_rooms] or pill_rooms
            selected_rooms = st.pills(
                t('room_count'), 
                pill_rooms, 
                selection_mode="multi",
                label_visibility="collapsed",
                key="rooms"
            )
            if not selected_rooms:
                st.stop()
            filtered_df = filtered_df[filtered_df['rooms'].isin(selected_rooms)]

            # Property Category with Pills
            all_cats = sorted(filtered_df['category'].dropna().unique().tolist())
            st.write(t('prop_category'))
            
            # Select All Categories toggle
            if "categories" not in st.session_state:
                st.session_state.categories = all_cats
            
            is_all_cats = st.checkbox(t('select_all'), value=True, key="b_all_cats_check")
            
            # Reset logic for the toggle
            if is_all_cats != st.session_state.get('_last_b_all_cats', True):
                st.session_state.categories = all_cats if is_all_cats else []
                st.session_state._last_b_all_cats = is_all_cats

            selected_cats = st.pills(
                t('prop_category'), 
                all_cats, 
                selection_mode="multi",
                label_visibility="collapsed",
                key="categories"
            )
            if not selected_cats:
                st.stop()
            filtered_df = filtered_df[filtered_df['category'].isin(selected_cats)]

            st.divider()
            
            # Price Filter
            min_p = int(filtered_df['price_value'].min()) if not filtered_df.empty else 0
            max_p = int(filtered_df['price_value'].max()) if not filtered_df.empty else 1000000
            if "price" in st.session_state:
                low, high = st.session_state.price
                st.session_state.price = (max(min_p, min(max_p, low)), max(min_p, min(max_p, high)))
            else:
                st.session_state.price = _qp_get_range(qp, "price", (min_p, max_p), as_int=True)
            selected_price = st.slider(f"{t('price_range')} (₼)", min_p, max_p, key="price")
            filtered_df = filtered_df[(filtered_df['price_value'] >= selected_price[0]) & (filtered_df['price_value'] <= selected_price[1])]

            # Area Filter
            min_a = int(filtered_df['area_value'].min()) if not filtered_df.empty else 0
            max_a = int(filtered_df['area_value'].max()) if not filtered_df.empty else 2000
            if "area" in st.session_state:
                low, high = st.session_state.area
                st.session_state.area = (max(min_a, min(max_a, low)), max(min_a, min(max_a, high)))
            else:
                st.session_state.area = _qp_get_range(qp, "area", (min_a, max_a), as_int=True)
            selected_area = st.slider(f"{t('area_range')} (m²)", min_a, max_a, key="area")
            filtered_df = filtered_df[(filtered_df['area_value'] >= selected_area[0]) & (filtered_df['area_value'] <= selected_area[1])]

            # Unit Price Filter (Sale only)
            if selected_op == "Sale":
                min_u = int(filtered_df['price_per_m2'].min()) if not filtered_df.empty else 0
                max_u = int(filtered_df['price_per_m2'].max()) if not filtered_df.empty else 10000
                if "price_m2" in st.session_state:
                    low, high = st.session_state.price_m2
                    st.session_state.price_m2 = (max(min_u, min(max_u, low)), max(min_u, min(max_u, high)))
                else:
                    st.session_state.price_m2 = _qp_get_range(qp, "price_m2", (min_u, max_u), as_int=True)
                selected_u = st.slider(f"{t('unit_price_range')} (₼/m²)", min_u, max_u, key="price_m2")
                filtered_df = filtered_df[(filtered_df['price_per_m2'] >= selected_u[0]) & (filtered_df['price_per_m2'] <= selected_u[1])]
        
        st.sidebar.info(t('showing_listings').format(len(filtered_df)))

    # --- Bina.az Metrics & Charts ---
    
    # KPI Row
    m1, m2, m3, m4 = st.columns(4)
    m1.metric(t('total_listings'), f"{len(filtered_df):,}")
    
    if selected_op == "Rent":
         med_price = filtered_df['price_value'].median()
         m2.metric(t('median_rent'), f"{med_price:,.0f} ₼")
         avg_rooms = filtered_df['rooms'].mean()
         m3.metric(t('avg_rooms'), f"{avg_rooms:.1f}")
         avg_area = filtered_df['area_value'].mean()
         m4.metric(t('avg_area'), f"{avg_area:.1f} m²")
    else:
         med_price_m2 = filtered_df['price_per_m2'].median()
         m2.metric(t('median_price_m2'), f"{med_price_m2:,.0f} ₼")
         med_total = filtered_df['price_value'].median()
         m3.metric(t('median_total'), f"{med_total:,.0f} ₼")
         avg_area = filtered_df['area_value'].mean()
         m4.metric(t('avg_area'), f"{avg_area:.1f} m²")

    # Tabs Layout
    tab1, tab2, tab3 = st.tabs([t('reg_analysis'), t('market_trends'), t('prop_details_tab')])
    
    metric_label = "Price" if selected_op == "Rent" else "Price per m²"
    metric_col = "median_total" if selected_op == "Rent" else "median_m2"
    
    with tab1:
        st.subheader(f"{t('reg_analysis')} ({selected_op})")
        
        region_stats = filtered_df.groupby(['location_name', 'period'], observed=True).agg(
            median_m2=('price_per_m2', 'median'),
            median_total=('price_value', 'median'),
            count=('price_value', 'count')
        ).reset_index()
        region_stats = region_stats[region_stats['count'] >= min_ads]
        
        order_col = 'median_total' if selected_op == "Rent" else 'median_m2'
        order = region_stats.groupby('location_name', observed=True)[order_col].median().sort_values(ascending=True).index
        region_stats['location_name'] = pd.Categorical(region_stats['location_name'], categories=order, ordered=True)
        region_stats = region_stats.sort_values('location_name')
        
        h = max(500, len(region_stats['location_name'].unique()) * 25 + 100)
        
        fig_reg = px.bar(region_stats, y='location_name', x=metric_col, color='period', barmode='group', 
                        orientation='h', title=f"Median {metric_label} by Region", height=h, 
                        hover_data={'count':True}, template="plotly_white")
        st.plotly_chart(fig_reg, width="stretch")
        
        if selected_op == "Sale":
            st.divider()
            chart_title = f"{t('median_total' if selected_op == 'Rent' else 'median_price_m2')} ({t(selected_op)}) - {t('reg_analysis')}"
            fig_total = px.bar(region_stats, y='location_name', x='median_total', color='period', barmode='group', 
                              orientation='h', title=chart_title, height=h, 
                              labels={'location_name': t('location'), 'median_total': t('median_total'), 'period': t('filter_time')},
                              hover_data={'count':True}, template="plotly_white")
            st.plotly_chart(fig_total, width="stretch")

    with tab2:
        st.subheader(t('price_movement'))
        trend_stats = filtered_df.groupby(['period'], observed=True).agg(
            median_m2=('price_per_m2', 'median'),
            median_total=('price_value', 'median'),
            count=('price_value', 'count')
        ).reset_index()
        
        trend_y = 'median_total' if selected_op == "Rent" else 'median_m2'
        fig_trend = px.line(trend_stats, x='period', y=trend_y, markers=True, 
                           labels={'period': t('filter_time'), trend_y: t('median_total' if selected_op == 'Rent' else 'median_price_m2')},
                           title=f"{t('price_movement')} ({t(selected_op)})", template="plotly_white")
        st.plotly_chart(fig_trend, width="stretch")

    with tab3:
        c1, c2 = st.columns(2)
        
        with c1:
            st.markdown(f"##### {t('price_vs_area')}")
            # Histogram of Price (Rent) or Price per m2 (Sale)
            dist_col = "price_value" if selected_op == "Rent" else "price_per_m2"
            dist_title = t('dist_total_price') if selected_op == "Rent" else t('dist_price_m2')
            
            fig_dist = px.histogram(filtered_df, x=dist_col, color="period", marginal="box", 
                                    labels={dist_col: t('median_total' if selected_op == 'Rent' else 'median_price_m2'), 'period': t('filter_time')},
                                    title=dist_title, nbins=100, barmode='overlay', template="plotly_white")
            st.plotly_chart(fig_dist, width="stretch")

        with c2:
            st.markdown(f"##### {t('rooms_analysis')}")
            room_stats = filtered_df[filtered_df['rooms'] <= 10].groupby(['rooms', 'period'], observed=True).agg(
                median_m2=('price_per_m2', 'median'),
                median_total=('price_value', 'median'),
                count=('price_value', 'count')
            ).reset_index()
            
            room_y = 'median_total' if selected_op == "Rent" else 'median_m2'
            period_order = sorted(room_stats['period'].unique().tolist())
            palette = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"]
            period_colors = {p: palette[i % len(palette)] for i, p in enumerate(period_order)}
            fig_room = px.line(
                room_stats,
                x='rooms',
                y=room_y,
                color='period',
                markers=True,
                labels={'rooms': t('room_count'), room_y: t('median_total' if selected_op == 'Rent' else 'median_price_m2'), 'period': t('filter_time')},
                title=f"{t('median_total' if selected_op == 'Rent' else 'median_price_m2')} ({t(selected_op)}) - {t('rooms_analysis')}",
                template="plotly_white",
                color_discrete_map=period_colors
            )
            st.plotly_chart(fig_room, width="stretch")
        
        st.divider()
        st.subheader(t('cat_breakdown'))
        
        category_counts = filtered_df['category'].value_counts(normalize=True)
        top_categories = category_counts[category_counts > 0.01].index
        cat_df = filtered_df[filtered_df['category'].isin(top_categories)].copy()
        if hasattr(cat_df['category'], 'cat'):
            cat_df['category'] = cat_df['category'].cat.remove_unused_categories()
        else:
            cat_df['category'] = cat_df['category'].astype('category')
        
        cat_metric = 'median_total' if selected_op == "Rent" else 'median_m2'
        cat_stats = cat_df.groupby(['category', 'period'], observed=True).agg(
            median_m2=('price_per_m2', 'median'), 
            median_total=('price_value', 'median'),
            count=('price_value', 'count')
        ).reset_index()
        
        cat_order = cat_stats.groupby('category', observed=True)[cat_metric].median().sort_values(ascending=False).index
        cat_stats['category'] = pd.Categorical(cat_stats['category'], categories=cat_order, ordered=True)
        
        fig_cat = px.bar(cat_stats.sort_values('category'), x='category', y=cat_metric, color='period', 
                        barmode='group', title=f"Median {metric_label} by Category", template="plotly_white")
        st.plotly_chart(fig_cat, width="stretch")

elif project == "Markets":
    try:
        df = load_markets_data()
    except Exception as e:
        st.error(f"Failed to load data: {e}")
        st.stop()

    if df.empty:
        st.warning("No Markets data found.")
        st.stop()

    # Markets Slicers
    with st.sidebar:
        with st.expander("💰 " + t('filter_price'), expanded=True):
            min_p = float(df['price'].min())
            max_p = float(df['price'].max())
            if "m_price" in st.session_state:
                low, high = st.session_state.m_price
                st.session_state.m_price = (max(min_p, min(max_p, low)), max(min_p, min(max_p, high)))
            else:
                st.session_state.m_price = (min_p, max_p)
            price_range = st.slider(t('price_range'), min_p, max_p, key="m_price")
            filtered_df = df[(df['price'] >= price_range[0]) & (df['price'] <= price_range[1])]
        
        with st.expander("📝 " + t('products'), expanded=True):
            # Category Filter
            all_cats = sorted(filtered_df['category'].dropna().unique().tolist())
            st.write(f"📂 {t('category')}")
            
            if "m_cats" not in st.session_state:
                st.session_state.m_cats = all_cats
            
            is_all_m_cats = st.checkbox(t('select_all'), value=True, key="m_all_cats_check")
            
            if is_all_m_cats != st.session_state.get('_last_m_all_cats', True):
                st.session_state.m_cats = all_cats if is_all_m_cats else []
                st.session_state._last_m_all_cats = is_all_m_cats

            sel_cats = st.pills(t('category'), all_cats, selection_mode="multi", key="m_cats", label_visibility="collapsed")
            if not sel_cats:
                sel_cats = all_cats
            filtered_df = filtered_df[filtered_df['category'].isin(sel_cats)]
            
            # Brand Filter (Top 50 to avoid clutter)
            all_brands = filtered_df['brand'].value_counts().index.tolist()
            top_brands = all_brands[:50]
            if "m_brands" not in st.session_state:
                 st.session_state.m_brands = []
            
            st.write(f"🏷️ {t('brands')}")
            sel_brands = st.multiselect(t('brands'), top_brands, key="m_brands", placeholder=t('all_brands_placeholder'), label_visibility="collapsed")
            if sel_brands:
                filtered_df = filtered_df[filtered_df['brand'].isin(sel_brands)]

        st.info(t('showing_listings').format(len(filtered_df)))

    # KPIs
    m1, m2, m3, m4 = st.columns(4)
    m1.metric(t('products'), f"{len(filtered_df):,}")
    m2.metric(t('med_price'), f"{filtered_df['price'].median():.2f} ₼")
    
    if 'discount_percent' in filtered_df.columns:
        disc_items = filtered_df[filtered_df['discount_percent'] > 0]
        avg_disc = disc_items['discount_percent'].mean()
        m3.metric(t('avg_discount'), f"{avg_disc:.1f}%" if not pd.isna(avg_disc) else "0%")
        m4.metric(t('discounted_items'), f"{len(disc_items):,}")
    else:
        m3.metric(t('avg_discount'), "N/A")
        m4.metric(t('discounted_items'), "0")

    # Visualizations
    tab1, tab2 = st.tabs([t('cat_analysis'), t('brand_overview')])
    
    with tab1:
        st.subheader(t('price_count_cat'))
        cat_stats = filtered_df.groupby('category', observed=True).agg(
            median_price=('price', 'median'),
            count=('price', 'count')
        ).reset_index()
        
        # Filter for better visual
        cat_stats = cat_stats[cat_stats['count'] > 0].sort_values('count', ascending=True)
        
        fig_cat = px.bar(cat_stats, y='category', x='count', orientation='h', 
                        title=t('num_products_cat'), template="plotly_white",
                        hover_data=['median_price'])
        st.plotly_chart(fig_cat, width="stretch")
        
        st.subheader(t('price_dist_cat'))
        fig_box = px.box(filtered_df, x='category', y='price', title=t('price_dist_cat'), template="plotly_white")
        fig_box.update_xaxes(tickangle=45)
        st.plotly_chart(fig_box, width="stretch")

    with tab2:
        st.subheader(t('top_brands_presence'))
        brand_stats = filtered_df.groupby('brand', observed=True).agg(
            median_price=('price', 'median'),
            count=('price', 'count')
        ).reset_index().sort_values('count', ascending=False).head(20)
        
        fig_brand = px.bar(brand_stats, x='brand', y='count', title=t('top_20_brands'), 
                          template="plotly_white", color='median_price')
        st.plotly_chart(fig_brand, width="stretch")

else: # Turbo.az
    df = load_turbo_data()
    if df.empty:
        st.warning("No Turbo.az data found.")
        st.stop()
    
    # Turbo.az Slicers
    with st.sidebar:
        with st.expander("📅 " + t('filter_time'), expanded=True):
            available_periods = sorted(df['period'].unique().tolist())
            if "t_periods" not in st.session_state:
                qp_periods = _qp_get_list(qp, "t_periods", available_periods)
                st.session_state.t_periods = [p for p in qp_periods if p in available_periods] or available_periods
            selected_periods = st.multiselect(t('select_months'), available_periods, key="t_periods")
            if not selected_periods:
                st.stop()
            filtered_df = df[df['period'].isin(selected_periods)]
        
        with st.expander("🚘 " + t('filter_car'), expanded=True):
            if "t_min_ads" not in st.session_state:
                st.session_state.t_min_ads = _qp_get_int(qp, "t_min_ads", 20)
            min_ads = st.slider(t('min_ads_brand'), 1, 500, key="t_min_ads")
            all_brands = sorted(filtered_df['brand'].unique().tolist())
            
            if "t_all_brands" not in st.session_state:
                qp_all_brands = _qp_get_value(qp, "t_all_brands", "false")
                st.session_state.t_all_brands = True if str(qp_all_brands).lower() == "true" else False
            
            # Checkbox for all brands
            is_all_brands = st.checkbox(t('select_all_brands'), key="t_all_brands")
            
            # Initialize or reset brands based on checkbox
            if "t_brands" not in st.session_state:
                if is_all_brands:
                    st.session_state.t_brands = all_brands
                else:
                    top_15 = filtered_df['brand'].value_counts().head(15).index.tolist()
                    qp_brands = _qp_get_list(qp, "t_brands", [])
                    st.session_state.t_brands = [b for b in qp_brands if b in all_brands] or sorted(top_15)
                st.session_state._last_t_all_brands = is_all_brands
            
            # Detect checkbox change to force multi-select update
            if is_all_brands != st.session_state.get('_last_t_all_brands', is_all_brands):
                if is_all_brands:
                    st.session_state.t_brands = all_brands
                else:
                    top_15 = filtered_df['brand'].value_counts().head(15).index.tolist()
                    st.session_state.t_brands = sorted(top_15)
                st.session_state._last_t_all_brands = is_all_brands

            selected_brands = st.multiselect(t('brands'), all_brands, key="t_brands")
                
            if not selected_brands:
                st.stop()
            filtered_df = filtered_df[filtered_df['brand'].isin(selected_brands)]

        with st.expander("💰 " + t('filter_price'), expanded=True):
            # Price Filter
            min_p = int(filtered_df['price_value'].min()) if not filtered_df.empty else 0
            max_p = int(filtered_df['price_value'].max()) if not filtered_df.empty else 1000000
            if "t_price" in st.session_state:
                # Clamp range to dynamic bounds
                low, high = st.session_state.t_price
                st.session_state.t_price = (max(min_p, min(max_p, low)), max(min_p, min(max_p, high)))
            else:
                st.session_state.t_price = _qp_get_range(qp, "t_price", (min_p, max_p), as_int=True)
            selected_price = st.slider(f"{t('price_range')} (₼)", min_p, max_p, key="t_price")
            filtered_df = filtered_df[(filtered_df['price_value'] >= selected_price[0]) & (filtered_df['price_value'] <= selected_price[1])]

            # Year Filter
            min_y = int(filtered_df['year'].min()) if not filtered_df.empty else 1970
            max_y = int(filtered_df['year'].max()) if not filtered_df.empty else 2026
            if "t_year" in st.session_state:
                # Clamp range to dynamic bounds
                low, high = st.session_state.t_year
                st.session_state.t_year = (max(min_y, min(max_y, low)), max(min_y, min(max_y, high)))
            else:
                st.session_state.t_year = _qp_get_range(qp, "t_year", (min_y, max_y), as_int=True)
            selected_year = st.slider(t('year_range'), min_y, max_y, key="t_year")
            filtered_df = filtered_df[(filtered_df['year'] >= selected_year[0]) & (filtered_df['year'] <= selected_year[1])]

            # Mileage Filter
            max_m = int(filtered_df['mileage_value'].max()) if not filtered_df.empty else 500000
            if "t_mileage" in st.session_state:
                # Clamp to dynamic max
                if st.session_state.t_mileage > max_m:
                    st.session_state.t_mileage = max_m
            else:
                st.session_state.t_mileage = _qp_get_int(qp, "t_mileage", max_m)
            selected_mileage = st.slider(f"🛣️ {t('max_mileage')} (km)", 0, max_m, key="t_mileage")
            filtered_df = filtered_df[filtered_df['mileage_value'] <= selected_mileage]

        with st.expander(t('filter_specs'), expanded=True):
            # Fuel Type
            fuels = sorted(filtered_df['fuel_type'].dropna().unique().tolist())
            st.write(f"⛽ {t('fuel_type')}")
            
            if "t_fuel" not in st.session_state:
                st.session_state.t_fuel = fuels
                
            is_all_fuel = st.checkbox(t('select_all'), value=True, key="t_all_fuel_check")
            
            if is_all_fuel != st.session_state.get('_last_t_all_fuel', True):
                st.session_state.t_fuel = fuels if is_all_fuel else []
                st.session_state._last_t_all_fuel = is_all_fuel

            selected_fuel = st.pills(t('fuel_type'), fuels, selection_mode="multi", key="t_fuel", label_visibility="collapsed")
            if not selected_fuel:
                st.stop()
            filtered_df = filtered_df[filtered_df['fuel_type'].isin(selected_fuel)]
            
            # Transmission
            trans = sorted(filtered_df['detail_transmission'].dropna().unique().tolist())
            st.write(f"⚙️ {t('transmission')}")
            
            if "t_trans" not in st.session_state:
                st.session_state.t_trans = trans
                
            is_all_trans = st.checkbox(t('select_all'), value=True, key="t_all_trans_check")
            
            if is_all_trans != st.session_state.get('_last_t_all_trans', True):
                st.session_state.t_trans = trans if is_all_trans else []
                st.session_state._last_t_all_trans = is_all_trans

            selected_trans = st.pills(t('transmission'), trans, selection_mode="multi", key="t_trans", label_visibility="collapsed")
            if not selected_trans:
                st.stop()
            filtered_df = filtered_df[filtered_df['detail_transmission'].isin(selected_trans)]
            
            # Body Type
            bodies = sorted(filtered_df['detail_body_type'].dropna().unique().tolist())
            st.write(f"🚗 {t('body_type')}")
            
            if "t_bodies" not in st.session_state:
                st.session_state.t_bodies = bodies
                
            is_all_bodies = st.checkbox(t('select_all'), value=True, key="t_all_bodies_check")
            
            if is_all_bodies != st.session_state.get('_last_t_all_bodies', True):
                st.session_state.t_bodies = bodies if is_all_bodies else []
                st.session_state._last_t_all_bodies = is_all_bodies

            selected_bodies = st.pills(t('body_type'), bodies, selection_mode="multi", key="t_bodies", label_visibility="collapsed")
            if not selected_bodies:
                st.stop()
            filtered_df = filtered_df[filtered_df['detail_body_type'].isin(selected_bodies)]
        
        st.info(t('showing_ads').format(len(filtered_df)))

    # --- Turbo.az Metrics & Charts ---
    
    # KPI Row
    m1, m2, m3, m4 = st.columns(4)
    m1.metric(t('total_ads'), f"{len(filtered_df):,}")
    m2.metric(t('med_price'), f"{filtered_df['price_value'].median():,.0f} ₼")
    m3.metric(t('avg_year'), f"{int(filtered_df['year'].mean())}")
    m4.metric(t('avg_mileage'), f"{filtered_df['mileage_value'].mean():,.0f} km")

    # Tabs Layout
    tab1, tab2, tab3 = st.tabs([t('brand_price'), t('tech_specs'), t('age_trends')])

    with tab1:
        st.subheader(t('brand_market_overview'))
        
        brand_stats = filtered_df.groupby(['brand', 'period'], observed=True).agg(
            median_price=('price_value', 'median'), count=('price_value', 'count')
        ).reset_index()
        brand_stats = brand_stats[brand_stats['count'] >= min_ads]
        brand_order = brand_stats.groupby('brand', observed=True)['median_price'].median().sort_values(ascending=True).index
        brand_stats['brand'] = pd.Categorical(brand_stats['brand'], categories=brand_order, ordered=True)
        h = max(500, len(brand_stats['brand'].unique()) * 25 + 100)
        
        fig_brand = px.bar(brand_stats.sort_values('brand'), y='brand', x='median_price', color='period', 
                          barmode='group', orientation='h', title=t('brand_market_overview'), height=h, 
                          hover_data={'count':True}, template="plotly_white")
        st.plotly_chart(fig_brand, width="stretch")

        st.divider()
        st.subheader(t('body_type_analysis'))
        cat_counts = filtered_df['detail_body_type'].value_counts(normalize=True)
        top_cats = cat_counts[cat_counts > 0.01].index
        cat_df = filtered_df[filtered_df['detail_body_type'].isin(top_cats)].copy()
        if hasattr(cat_df['detail_body_type'], 'cat'):
            cat_df['detail_body_type'] = cat_df['detail_body_type'].cat.remove_unused_categories()
        else:
            cat_df['detail_body_type'] = cat_df['detail_body_type'].astype('category')
        cat_stats = cat_df.groupby(['detail_body_type', 'period'], observed=True).agg(
            median_price=('price_value', 'median'), count=('price_value', 'count')
        ).reset_index()
        
        fig_cat = px.bar(cat_stats, x='detail_body_type', y='median_price', color='period', 
                        barmode='group', title=t('body_type_analysis'), template="plotly_white")
        st.plotly_chart(fig_cat, width="stretch")

    with tab2:
        st.subheader(t('engine_fuel'))
        c1, c2 = st.columns(2)
        
        with c1:
            fuel_stats = filtered_df.groupby(['fuel_type', 'period'], observed=True).agg(
                median_price=('price_value', 'median'), count=('price_value', 'count')
            ).reset_index()
            fuel_stats = fuel_stats[fuel_stats['count'] >= min_ads]
            
            fig_fuel = px.bar(fuel_stats, x='fuel_type', y='median_price', color='period', 
                             barmode='group', title=t('fuel_type'), template="plotly_white")
            st.plotly_chart(fig_fuel, width="stretch")

        with c2:
            # Clean up engine volume (ignore outliers > 8L)
            engine_df = filtered_df[(filtered_df['engine_vol'] > 0) & (filtered_df['engine_vol'] <= 8.0)]
            engine_stats = engine_df.groupby(['engine_vol', 'period'], observed=True).agg(
                median_price=('price_value', 'median'), count=('price_value', 'count')
            ).reset_index()
            engine_stats = engine_stats[engine_stats['count'] > 10]
            
            fig_eng = px.line(engine_stats, x='engine_vol', y='median_price', color='period', markers=True, 
                             title="Price vs Engine Volume (L)", template="plotly_white")
            st.plotly_chart(fig_eng, width="stretch")

    with tab3:
        st.subheader(t('depreciation'))
        
        year_stats = filtered_df.groupby(['year_bucket', 'period'], observed=True).agg(
            median_price=('price_value', 'median'), count=('price_value', 'count')
        ).reset_index()
        year_stats = year_stats[year_stats['count'] > 5]
        
        year_order = ["< 1990", "1990-1995", "1996-2000", "2001-2005", "2006-2010", "2011-2015", "2016-2019", "2020-2026"]
        year_stats['year_bucket'] = pd.Categorical(year_stats['year_bucket'], categories=year_order, ordered=True)
        
        fig_year = px.bar(year_stats.sort_values('year_bucket'), x='year_bucket', y='median_price', 
                         color='period', barmode='group', title=t('price_by_year'), template="plotly_white")
        st.plotly_chart(fig_year, width="stretch")

        st.divider()
        
        # Bucket mileage to show cleaner trend
        filtered_df['mileage_bucket'] = (filtered_df['mileage_value'] // 50000) * 50000
        mileage_stats = filtered_df[filtered_df['mileage_value'] < 500000].groupby(['mileage_bucket', 'period'], observed=True).agg(
            median_price=('price_value', 'median'), count=('price_value', 'count')
        ).reset_index()
        mileage_stats = mileage_stats[mileage_stats['count'] > 20]
        
        fig_mil = px.line(mileage_stats, x='mileage_bucket', y='median_price', color='period', markers=True, 
                         title=t('price_vs_mileage'), template="plotly_white")
        st.plotly_chart(fig_mil, width="stretch")

# --- Export Section ---
st.sidebar.divider()
st.sidebar.subheader(t('export'))

@st.cache_data
def convert_to_csv(df):
    return df.to_csv(index=False).encode('utf-8-sig')

@st.cache_data
def convert_to_excel(df):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Filtered Data')
    return output.getvalue()

csv_data = convert_to_csv(filtered_df)
st.sidebar.download_button(
    label=t('download_csv'),
    data=csv_data,
    file_name=f"{project.lower()}_filtered.csv",
    mime='text/csv'
)

excel_data = convert_to_excel(filtered_df)
st.sidebar.download_button(
    label=t('download_excel'),
    data=excel_data,
    file_name=f"{project.lower()}_filtered.xlsx",
    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)

st.sidebar.divider()
st.sidebar.caption("Data Source: Market Aggregator")

# --- Persist state to URL query params (refresh-safe) ---
params = {}
_qp_set_param(params, "lang", st.session_state.get("lang"))
_qp_set_param(params, "project", project)

if project == "Bina.az":
    _qp_set_param(params, "op", st.session_state.get("op_type"))
    _qp_set_param(params, "periods", st.session_state.get("periods"))
    _qp_set_param(params, "min_ads_region", st.session_state.get("min_ads_region"))
    _qp_set_param(params, "reg_mode", st.session_state.get("reg_mode"))
    _qp_set_param(params, "regions", st.session_state.get("regions"))
    _qp_set_param(params, "rooms", st.session_state.get("rooms"))
    _qp_set_param(params, "categories", st.session_state.get("categories"))
elif project == "Markets":
    _qp_set_param(params, "m_price", st.session_state.get("m_price"))
    _qp_set_param(params, "m_cats", st.session_state.get("m_cats"))
    _qp_set_param(params, "m_brands", st.session_state.get("m_brands"))
else:
    _qp_set_param(params, "t_periods", st.session_state.get("t_periods"))
    _qp_set_param(params, "t_min_ads", st.session_state.get("t_min_ads"))
    _qp_set_param(params, "t_all_brands", st.session_state.get("t_all_brands"))
    _qp_set_param(params, "t_brands", st.session_state.get("t_brands"))
    _qp_set_param(params, "t_price", st.session_state.get("t_price"))
    _qp_set_param(params, "t_year", st.session_state.get("t_year"))
    _qp_set_param(params, "t_mileage", st.session_state.get("t_mileage"))
    _qp_set_param(params, "t_fuel", st.session_state.get("t_fuel"))
    _qp_set_param(params, "t_trans", st.session_state.get("t_trans"))
    _qp_set_param(params, "t_bodies", st.session_state.get("t_bodies"))

_qp_set(params)


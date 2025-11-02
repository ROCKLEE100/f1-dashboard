from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import json
from datetime import datetime
import sqlite3
import pandas as pd
from io import StringIO
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="F1 Data Dashboard API")

# Get configuration from environment variables

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "f1_database.db"))
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
F1_API_BASE_URL = os.getenv("F1_API_BASE_URL", "https://api.jolpi.ca/ergast/f1")

# CORS configuration
# Allow all origins since Ingress handles routing
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all since Ingress routes everything
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database initialization
def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_type TEXT,
            data TEXT,
            insights TEXT
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS f1_data_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_type TEXT NOT NULL,
            data TEXT NOT NULL,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

init_db()

# Models
class F1APIConfig(BaseModel):
    api_key: str

class FileInsight(BaseModel):
    file_id: int
    insights: str

# Database helper functions
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def save_file_to_db(filename: str, file_type: str, data: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO uploaded_files (filename, file_type, data) VALUES (?, ?, ?)",
        (filename, file_type, data)
    )
    conn.commit()
    file_id = cursor.lastrowid
    conn.close()
    return file_id

def update_file_insights(file_id: int, insights: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE uploaded_files SET insights = ? WHERE id = ?",
        (insights, file_id)
    )
    conn.commit()
    conn.close()

def analyze_csv_data(df: pd.DataFrame) -> dict:
    """Generate comprehensive and meaningful insights from CSV data"""
    insights = []
    charts_data = {}
    
    # Check if CSV was parsed correctly
    if len(df.columns) == 1:
        # Try to detect the delimiter and re-parse
        col_name = df.columns[0]
        if ',' in col_name or ';' in col_name or '\t' in col_name:
            return {
                "insights": [{
                    "type": "⚠️ CSV Parsing Error",
                    "insight": "The CSV file wasn't parsed correctly. All data appears in one column.",
                    "details": "This usually happens when the delimiter is incorrect. Please ensure your CSV uses commas (,) as separators and is properly formatted."
                }],
                "charts": {},
                "summary": {
                    "total_rows": len(df),
                    "total_columns": len(df.columns),
                    "columns": df.columns.tolist()
                }
            }
    
    # Clean column names - remove extra spaces
    df.columns = df.columns.str.strip()
    
    # Detect what kind of data we have
    has_driver = any(col.lower() in ['driver', 'driver_name', 'drivername'] for col in df.columns)
    has_team = any(col.lower() in ['team', 'team_name', 'constructor', 'teamname'] for col in df.columns)
    has_lap_time = any('lap' in col.lower() and ('time' in col.lower() or 'seconds' in col.lower()) for col in df.columns)
    has_position = any(col.lower() in ['position', 'pos', 'finishing_position'] for col in df.columns)
    has_circuit = any(col.lower() in ['circuit', 'track', 'circuit_name'] for col in df.columns)
    has_points = any(col.lower() in ['points', 'championship_points'] for col in df.columns)
    has_lap_number = any('lap' in col.lower() and 'number' in col.lower() for col in df.columns)
    has_date = any(col.lower() in ['date', 'race_date', 'session_date'] for col in df.columns)
    
    # Find the actual column names
    driver_col = next((col for col in df.columns if col.lower() in ['driver', 'driver_name', 'drivername']), None)
    team_col = next((col for col in df.columns if col.lower() in ['team', 'team_name', 'constructor', 'teamname']), None)
    lap_time_col = next((col for col in df.columns if 'lap' in col.lower() and ('time' in col.lower() or 'seconds' in col.lower())), None)
    position_col = next((col for col in df.columns if col.lower() in ['position', 'pos', 'finishing_position']), None)
    circuit_col = next((col for col in df.columns if col.lower() in ['circuit', 'track', 'circuit_name']), None)
    points_col = next((col for col in df.columns if col.lower() in ['points', 'championship_points']), None)
    lap_number_col = next((col for col in df.columns if 'lap' in col.lower() and 'number' in col.lower()), None)
    date_col = next((col for col in df.columns if col.lower() in ['date', 'race_date', 'session_date']), None)
    
    # Dataset Overview
    insights.append({
        "type": "Dataset Overview",
        "insight": f"Analyzing {len(df):,} records across {len(df.columns)} data fields",
        "details": f"Data contains: {', '.join(df.columns.tolist())}"
    })
    
    # DRIVER PERFORMANCE ANALYSIS
    if has_driver and has_lap_time and driver_col and lap_time_col:
        try:
            # Convert lap time to numeric if needed
            df[lap_time_col] = pd.to_numeric(df[lap_time_col], errors='coerce')
            
            # Calculate driver statistics
            driver_stats = df.groupby(driver_col).agg({
                lap_time_col: ['mean', 'min', 'std', 'count']
            }).round(3)
            
            driver_stats.columns = ['avg_time', 'fastest_time', 'consistency', 'total_laps']
            driver_stats = driver_stats.sort_values('avg_time')
            
            # Fastest driver analysis
            fastest_driver = driver_stats.index[0]
            fastest_avg = driver_stats.iloc[0]['avg_time']
            fastest_best = driver_stats.iloc[0]['fastest_time']
            fastest_laps = int(driver_stats.iloc[0]['total_laps'])
            
            insights.append({
                "type": "🏆 Fastest Driver",
                "insight": f"{fastest_driver} dominates with an average lap time of {fastest_avg:.3f}s (best: {fastest_best:.3f}s)",
                "details": f"Based on {fastest_laps} laps. Their consistency (std dev: {driver_stats.iloc[0]['consistency']:.3f}s) shows reliable performance."
            })
            
            # Performance gap analysis
            if len(driver_stats) > 1:
                second_driver = driver_stats.index[1]
                second_avg = driver_stats.iloc[1]['avg_time']
                gap = second_avg - fastest_avg
                gap_percent = (gap / fastest_avg) * 100
                
                insights.append({
                    "type": "⚡ Performance Gap",
                    "insight": f"{fastest_driver} is {gap:.3f}s ({gap_percent:.2f}%) faster than {second_driver} on average",
                    "details": f"This {gap:.3f}s advantage translates to significant track position over a full race distance."
                })
            
            # Most consistent driver
            most_consistent = driver_stats.nsmallest(1, 'consistency')
            if len(most_consistent) > 0:
                consistent_driver = most_consistent.index[0]
                consistency_val = most_consistent.iloc[0]['consistency']
                
                insights.append({
                    "type": "🎯 Most Consistent Driver",
                    "insight": f"{consistent_driver} shows exceptional consistency with only {consistency_val:.3f}s variation between laps",
                    "details": "Low variation indicates predictable pace and excellent car control throughout stints."
                })
            
            # Prepare chart data - top 10 drivers
            top_drivers = driver_stats.head(10)
            charts_data['driver_performance'] = [
                {
                    "driver": driver, 
                    "avg_lap_time": float(row['avg_time']),
                    "fastest_lap": float(row['fastest_time']),
                    "laps_completed": int(row['total_laps'])
                }
                for driver, row in top_drivers.iterrows()
            ]
            
        except Exception as e:
            print(f"Error in driver analysis: {e}")
    
    # TEAM PERFORMANCE ANALYSIS
    if has_team and has_lap_time and team_col and lap_time_col:
        try:
            df[lap_time_col] = pd.to_numeric(df[lap_time_col], errors='coerce')
            
            team_stats = df.groupby(team_col).agg({
                lap_time_col: ['mean', 'min', 'count']
            }).round(3)
            
            team_stats.columns = ['avg_time', 'best_time', 'total_laps']
            team_stats = team_stats.sort_values('avg_time')
            
            fastest_team = team_stats.index[0]
            team_avg = team_stats.iloc[0]['avg_time']
            team_best = team_stats.iloc[0]['best_time']
            
            insights.append({
                "type": "🏎 Fastest Team",
                "insight": f"{fastest_team} leads constructor performance with {team_avg:.3f}s average lap time",
                "details": f"Team's best lap: {team_best:.3f}s. Data from {int(team_stats.iloc[0]['total_laps'])} combined laps."
            })
            
            # Team battle
            if len(team_stats) > 1:
                slowest_team = team_stats.index[-1]
                slowest_avg = team_stats.iloc[-1]['avg_time']
                team_spread = slowest_avg - team_avg
                
                insights.append({
                    "type": "📊 Constructor Spread",
                    "insight": f"{team_spread:.3f}s separates {fastest_team} from {slowest_team} - showing the competitive gap in the field",
                    "details": f"The top team is {((team_spread / slowest_avg) * 100):.1f}% faster than the slowest team."
                })
            
            charts_data['team_performance'] = [
                {
                    "team": team,
                    "avg_lap_time": float(row['avg_time']),
                    "best_lap": float(row['best_time'])
                }
                for team, row in team_stats.iterrows()
            ]
            
        except Exception as e:
            print(f"Error in team analysis: {e}")
    
    # CIRCUIT ANALYSIS
    if has_circuit and has_lap_time and circuit_col and lap_time_col:
        try:
            df[lap_time_col] = pd.to_numeric(df[lap_time_col], errors='coerce')
            
            circuit_stats = df.groupby(circuit_col).agg({
                lap_time_col: ['mean', 'min', 'max', 'count']
            }).round(3)
            
            circuit_stats.columns = ['avg_time', 'fastest_lap', 'slowest_lap', 'total_laps']
            
            # Find fastest and slowest circuits
            fastest_circuit = circuit_stats['avg_time'].idxmin()
            slowest_circuit = circuit_stats['avg_time'].idxmax()
            
            fastest_time = circuit_stats.loc[fastest_circuit, 'avg_time']
            slowest_time = circuit_stats.loc[slowest_circuit, 'avg_time']
            
            insights.append({
                "type": "🏎️ Fastest Circuit",
                "insight": f"{fastest_circuit} is the fastest track with {fastest_time:.3f}s average lap time",
                "details": f"Compared to {slowest_circuit} ({slowest_time:.3f}s), drivers are {(slowest_time - fastest_time):.3f}s quicker per lap."
            })
            
            # Circuit variety analysis
            if len(circuit_stats) > 1:
                time_range = circuit_stats['avg_time'].max() - circuit_stats['avg_time'].min()
                insights.append({
                    "type": "🌍 Track Variety",
                    "insight": f"{len(circuit_stats)} circuits analyzed with {time_range:.3f}s variation in lap times",
                    "details": "This variation reflects different track characteristics - high-speed circuits vs technical tracks."
                })
            
            charts_data['circuit_comparison'] = [
                {
                    "circuit": circuit,
                    "avg_lap_time": float(row['avg_time']),
                    "fastest_lap": float(row['fastest_lap']),
                    "laps": int(row['total_laps'])
                }
                for circuit, row in circuit_stats.iterrows()
            ]
            
        except Exception as e:
            print(f"Error in circuit analysis: {e}")
    
    # CHAMPIONSHIP POINTS ANALYSIS
    if has_driver and has_points and driver_col and points_col:
        try:
            df[points_col] = pd.to_numeric(df[points_col], errors='coerce')
            
            points_standings = df.groupby(driver_col)[points_col].sum().sort_values(ascending=False)
            
            if len(points_standings) > 0:
                leader = points_standings.index[0]
                leader_points = points_standings.iloc[0]
                
                insights.append({
                    "type": "👑 Championship Leader",
                    "insight": f"{leader} leads the standings with {int(leader_points)} points",
                    "details": f"Total points across all drivers: {int(points_standings.sum())}"
                })
                
                if len(points_standings) > 1:
                    second = points_standings.index[1]
                    second_points = points_standings.iloc[1]
                    gap = leader_points - second_points
                    
                    insights.append({
                        "type": "🏆 Title Fight",
                        "insight": f"{int(gap)} points separate {leader} from {second} in championship battle",
                        "details": f"With 25 points per win, this is approximately {(gap / 25):.1f} race wins advantage."
                    })
        except Exception as e:
            print(f"Error in points analysis: {e}")
    
    # RACE PACE ANALYSIS (if lap numbers available)
    if has_driver and has_lap_time and has_lap_number and driver_col and lap_time_col and lap_number_col:
        try:
            df[lap_time_col] = pd.to_numeric(df[lap_time_col], errors='coerce')
            df[lap_number_col] = pd.to_numeric(df[lap_number_col], errors='coerce')
            
            # Analyze pace degradation
            early_laps = df[df[lap_number_col] <= 10][lap_time_col].mean()
            late_laps = df[df[lap_number_col] > 10][lap_time_col].mean()
            
            if pd.notna(early_laps) and pd.notna(late_laps):
                degradation = late_laps - early_laps
                
                if degradation > 0.5:
                    insights.append({
                        "type": "⏱️ Tire Degradation",
                        "insight": f"Lap times degrade by {degradation:.3f}s from early to late stint",
                        "details": f"Early laps (1-10): {early_laps:.3f}s avg, Later laps: {late_laps:.3f}s avg - indicating tire wear."
                    })
                else:
                    insights.append({
                        "type": "⏱️ Consistent Pace",
                        "insight": f"Minimal pace drop-off of only {degradation:.3f}s throughout the stint",
                        "details": "Stable lap times suggest good tire management or fresh compound usage."
                    })
        except Exception as e:
            print(f"Error in pace analysis: {e}")
    
    # OVERALL STATISTICS
    if has_lap_time and lap_time_col:
        try:
            df[lap_time_col] = pd.to_numeric(df[lap_time_col], errors='coerce')
            
            fastest_lap_overall = df[lap_time_col].min()
            slowest_lap_overall = df[lap_time_col].max()
            avg_lap_overall = df[lap_time_col].mean()
            median_lap = df[lap_time_col].median()
            
            insights.append({
                "type": "📈 Overall Lap Time Statistics",
                "insight": f"Track record: {fastest_lap_overall:.3f}s | Average: {avg_lap_overall:.3f}s | Median: {median_lap:.3f}s",
                "details": f"Lap time range: {(slowest_lap_overall - fastest_lap_overall):.3f}s across all {len(df)} laps analyzed."
            })
        except Exception as e:
            print(f"Error in overall stats: {e}")
    
    # DATE RANGE ANALYSIS
    if has_date and date_col:
        try:
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            valid_dates = df[date_col].dropna()
            
            if len(valid_dates) > 0:
                date_range_start = valid_dates.min().strftime('%Y-%m-%d')
                date_range_end = valid_dates.max().strftime('%Y-%m-%d')
                total_days = (valid_dates.max() - valid_dates.min()).days
                
                insights.append({
                    "type": "📅 Time Period",
                    "insight": f"Data spans from {date_range_start} to {date_range_end} ({total_days} days)",
                    "details": f"Covers {valid_dates.nunique()} unique dates with racing activity."
                })
        except Exception as e:
            print(f"Error in date analysis: {e}")
    
    return {
        "insights": insights,
        "charts": charts_data,
        "summary": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": df.columns.tolist()
        }
    }

# F1 API Integration using Jolpica (Ergast) API
@app.post("/api/f1/fetch-data")
async def fetch_f1_data(config: F1APIConfig):
    """Fetch current F1 season data from Jolpica API"""
    try:
        current_year = 2024
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch driver standings
            driver_standings_response = await client.get(
                f"{F1_API_BASE_URL}/{current_year}/driverStandings.json"
            )
            driver_data = driver_standings_response.json()
            
            # Fetch constructor standings
            constructor_response = await client.get(
                f"{F1_API_BASE_URL}/{current_year}/constructorStandings.json"
            )
            constructor_data = constructor_response.json()
            
            # Fetch latest race results
            races_response = await client.get(
                f"{F1_API_BASE_URL}/{current_year}/results.json?limit=1000"
            )
            races_data = races_response.json()
            
            # Parse driver standings
            driver_standings = []
            if driver_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists'):
                standings_list = driver_data['MRData']['StandingsTable']['StandingsLists'][0]
                for standing in standings_list.get('DriverStandings', []):
                    driver = standing['Driver']
                    driver_standings.append({
                        'position': int(standing['position']),
                        'full_name': f"{driver['givenName']} {driver['familyName']}",
                        'driver_number': driver.get('permanentNumber', 'N/A'),
                        'team_name': standing['Constructors'][0]['name'] if standing.get('Constructors') else 'Unknown',
                        'team_colour': '000000',
                        'points': float(standing['points']),
                        'wins': int(standing['wins'])
                    })
            
            # Parse constructor standings
            constructor_standings = []
            if constructor_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists'):
                standings_list = constructor_data['MRData']['StandingsTable']['StandingsLists'][0]
                for standing in standings_list.get('ConstructorStandings', []):
                    constructor = standing['Constructor']
                    constructor_standings.append({
                        'position': int(standing['position']),
                        'team_name': constructor['name'],
                        'team_colour': '000000',
                        'points': float(standing['points']),
                        'wins': int(standing['wins'])
                    })
            
            # Get latest race information
            latest_race = None
            race_results = []
            if races_data.get('MRData', {}).get('RaceTable', {}).get('Races'):
                races = races_data['MRData']['RaceTable']['Races']
                if races:
                    last_race = races[-1]
                    latest_race = {
                        'meeting_name': last_race['raceName'],
                        'circuit_short_name': last_race['Circuit']['circuitName'],
                        'location': f"{last_race['Circuit']['Location']['locality']}, {last_race['Circuit']['Location']['country']}",
                        'date_start': last_race['date'],
                        'round': last_race['round'],
                        'season': last_race['season']
                    }
                    
                    # Parse race results
                    for result in last_race.get('Results', [])[:10]:
                        driver = result['Driver']
                        race_results.append({
                            'position': int(result['position']),
                            'driver_name': f"{driver['givenName']} {driver['familyName']}",
                            'driver_number': driver.get('permanentNumber', 'N/A'),
                            'team': result['Constructor']['name'],
                            'points': float(result['points']),
                            'status': result['status']
                        })
            
            # Cache the data
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO f1_data_cache (data_type, data) VALUES (?, ?)",
                ("combined", json.dumps({
                    "driver_standings": driver_standings,
                    "constructor_standings": constructor_standings,
                    "latest_race": latest_race,
                    "race_results": race_results
                }))
            )
            conn.commit()
            conn.close()
            
            return {
                "success": True,
                "data": {
                    "driver_standings": driver_standings,
                    "constructor_standings": constructor_standings,
                    "latest_race": latest_race,
                    "race_results": race_results
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching F1 data: {str(e)}")

@app.get("/api/f1/insights")
async def get_f1_insights():
    """Generate comprehensive insights from cached F1 data"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT data FROM f1_data_cache WHERE data_type = 'combined' ORDER BY fetched_at DESC LIMIT 1"
        )
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="No cached data found. Please fetch data first.")
        
        data = json.loads(result[0])
        insights = []
        
        # Championship Leader Insight
        if data.get("driver_standings") and len(data["driver_standings"]) > 0:
            leader = data["driver_standings"][0]
            insights.append({
                "type": "Championship Leader",
                "insight": f"{leader['full_name']} is currently leading the Drivers' Championship with {int(leader['points'])} points and {leader['wins']} race {'win' if leader['wins'] == 1 else 'wins'}.",
                "explanation": "This shows who is at the top of the season standings. The points are accumulated from race finishes throughout the season, with 25 points awarded for a win."
            })
            
            # Points Gap Analysis
            if len(data["driver_standings"]) > 1:
                second = data["driver_standings"][1]
                gap = leader['points'] - second['points']
                insights.append({
                    "type": "Championship Battle",
                    "insight": f"The gap between 1st and 2nd place is {int(gap)} points. {leader['full_name']} leads {second['full_name']} in the title fight.",
                    "explanation": "This margin indicates how competitive the championship is. A smaller gap means a closer battle, while a larger gap suggests one driver is dominating."
                })
            
            # Top 3 Summary
            if len(data["driver_standings"]) >= 3:
                top3 = data["driver_standings"][:3]
                insights.append({
                    "type": "Top 3 Drivers",
                    "insight": f"Podium positions: 1st {top3[0]['full_name']} ({int(top3[0]['points'])}pts), 2nd {top3[1]['full_name']} ({int(top3[1]['points'])}pts), 3rd {top3[2]['full_name']} ({int(top3[2]['points'])}pts)",
                    "explanation": "These are the three drivers with the best performance this season. They have consistently finished in high positions to accumulate the most points."
                })
        
        # Constructor Championship Insight
        if data.get("constructor_standings") and len(data["constructor_standings"]) > 0:
            top_team = data["constructor_standings"][0]
            insights.append({
                "type": "Top Constructor",
                "insight": f"{top_team['team_name']} leads the Constructors' Championship with {int(top_team['points'])} points from {top_team['wins']} race {'victory' if top_team['wins'] == 1 else 'victories'}.",
                "explanation": "The Constructors' Championship ranks teams based on combined points from both their drivers. This determines prize money and prestige for the teams."
            })
            
            # Team Battle
            if len(data["constructor_standings"]) > 1:
                second_team = data["constructor_standings"][1]
                team_gap = top_team['points'] - second_team['points']
                insights.append({
                    "type": "Team Battle",
                    "insight": f"In the team standings, {top_team['team_name']} leads {second_team['team_name']} by {int(team_gap)} points.",
                    "explanation": "This shows the competition between teams. Both drivers' results contribute to their team's total score."
                })
        
        # Latest Race Performance
        if data.get("latest_race"):
            race = data["latest_race"]
            insights.append({
                "type": "Most Recent Race",
                "insight": f"The latest race was the {race.get('meeting_name', 'Unknown')} at {race.get('circuit_short_name', 'Unknown Circuit')} in {race.get('location', 'Unknown')}.",
                "explanation": "This is the most recently completed Grand Prix. Results from this race have been factored into the current championship standings."
            })
            
            # Race winner insight
            if data.get("race_results") and len(data["race_results"]) > 0:
                winner = data["race_results"][0]
                insights.append({
                    "type": "Latest Race Winner",
                    "insight": f"{winner['driver_name']} ({winner['team']}) won the most recent race, earning 25 championship points.",
                    "explanation": "Race winners receive the maximum 25 points and strengthen their position in the championship fight."
                })
        
        # Competitive Analysis
        if data.get("driver_standings") and len(data["driver_standings"]) >= 5:
            total_wins_top5 = sum(d['wins'] for d in data["driver_standings"][:5])
            insights.append({
                "type": "Season Competitiveness",
                "insight": f"The top 5 drivers have combined for {total_wins_top5} race wins this season, showing {'high competitiveness with wins spread across multiple drivers' if total_wins_top5 > 10 else 'dominance by select drivers'}.",
                "explanation": "This metric indicates whether multiple drivers are winning races (competitive season) or if one or two drivers are dominating."
            })
        
        return {"insights": insights, "data": data}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

@app.get("/api/f1/historical/{year}")
async def get_historical_data(year: int):
    """Fetch historical F1 data for any year from 1950 onwards using Jolpica API"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Fetch all races for the specified year
            races_response = await client.get(
               f"{F1_API_BASE_URL}/{year}.json"
            )
            
            if races_response.status_code != 200:
                return {
                    "success": False,
                    "year": year,
                    "message": f"Unable to fetch data for {year}",
                    "races": [],
                    "race_count": 0
                }
            
            races_data = races_response.json()
            
            races = races_data.get('MRData', {}).get('RaceTable', {}).get('Races', [])
            
            if not races or len(races) == 0:
                return {
                    "success": False,
                    "year": year,
                    "message": f"No race data found for {year}. The Jolpica API has data from 1950-present.",
                    "races": [],
                    "race_count": 0
                }
            
            # Fetch driver standings for insights
            standings_response = await client.get(
                f"{F1_API_BASE_URL}/{year}/driverStandings.json"
            )
            standings_data = standings_response.json()
            
            champion = None
            if standings_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists'):
                standings_list = standings_data['MRData']['StandingsTable']['StandingsLists']
                if standings_list:
                    champion_data = standings_list[0]['DriverStandings'][0]
                    driver = champion_data['Driver']
                    champion = {
                        'name': f"{driver['givenName']} {driver['familyName']}",
                        'points': champion_data['points'],
                        'wins': champion_data['wins'],
                        'team': champion_data['Constructors'][0]['name'] if champion_data.get('Constructors') else 'Unknown'
                    }
            
            # Format races for frontend
            formatted_races = []
            for race in races:
                formatted_races.append({
                    'round': race['round'],
                    'meeting_name': race['raceName'],
                    'circuit_short_name': race['Circuit']['circuitName'],
                    'location': f"{race['Circuit']['Location']['locality']}, {race['Circuit']['Location']['country']}",
                    'date_start': race['date'],
                    'url': race.get('url', '')
                })
            
            return {
                "success": True,
                "year": year,
                "races": formatted_races,
                "race_count": len(formatted_races),
                "champion": champion,
                "insights": {
                    "season_summary": f"The {year} Formula 1 season consisted of {len(formatted_races)} races across {len(set(r['Circuit']['Location']['country'] for r in races))} countries.",
                    "champion_info": f"{champion['name']} won the {year} World Championship driving for {champion['team']}, with {champion['wins']} race wins and {champion['points']} points." if champion else None
                }
            }
    except Exception as e:
        return {
            "success": False,
            "year": year,
            "message": f"Error fetching historical data: {str(e)}",
            "races": [],
            "race_count": 0
        }

@app.post("/api/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and store file in database"""
    try:
        contents = await file.read()
        file_data = contents.decode('utf-8')
        
        # Determine file type
        file_type = "csv" if file.filename.endswith('.csv') else "json" if file.filename.endswith('.json') else "text"
        
        # Save to database
        file_id = save_file_to_db(file.filename, file_type, file_data)
        
        # Generate basic insights based on file type
        insights = []
        
        if file_type == "csv":
            df = pd.read_csv(StringIO(file_data))
            insights.append(f"CSV file with {len(df)} rows and {len(df.columns)} columns")
            insights.append(f"Columns: {', '.join(df.columns.tolist())}")
        elif file_type == "json":
            json_data = json.loads(file_data)
            insights.append(f"JSON file with {len(json_data)} root elements")
        
        return {
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "file_type": file_type,
            "initial_insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@app.get("/api/files/{file_id}/analyze")
async def analyze_file(file_id: int):
    """Analyze uploaded file and generate detailed insights"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT filename, file_type, data FROM uploaded_files WHERE id = ?",
            (file_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="File not found")
        
        filename, file_type, file_data = row[0], row[1], row[2]
        
        if file_type == "csv":
            df = pd.read_csv(StringIO(file_data))
            analysis = analyze_csv_data(df)
            
            # Store insights in database
            update_file_insights(file_id, json.dumps(analysis['insights']))
            
            return {
                "success": True,
                "filename": filename,
                "analysis": analysis
            }
        else:
            return {
                "success": False,
                "message": "Only CSV files can be analyzed at this time"
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing file: {str(e)}")

@app.post("/api/files/{file_id}/insights")
async def add_file_insights(file_id: int, insight: FileInsight):
    """Add insights to uploaded file"""
    try:
        update_file_insights(file_id, insight.insights)
        return {"success": True, "message": "Insights added successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding insights: {str(e)}")

@app.get("/api/files")
async def get_all_files():
    """Retrieve all uploaded files with insights"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, filename, upload_date, file_type, insights FROM uploaded_files ORDER BY upload_date DESC"
        )
        files = []
        for row in cursor.fetchall():
            files.append({
                "id": row[0],
                "filename": row[1],
                "upload_date": row[2],
                "file_type": row[3],
                "insights": row[4]
            })
        conn.close()
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving files: {str(e)}")

@app.get("/api/files/{file_id}")
async def get_file(file_id: int):
    """Retrieve specific file with full data and insights"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM uploaded_files WHERE id = ?",
            (file_id,)
        )
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="File not found")
        
        return {
            "id": row[0],
            "filename": row[1],
            "upload_date": row[2],
            "file_type": row[3],
            "data": row[4],
            "insights": row[5]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}")

@app.delete("/api/files/{file_id}")
async def delete_file(file_id: int):
    """Delete file from database"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM uploaded_files WHERE id = ?", (file_id,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "File deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")

@app.get("/")
async def root():
    return {"message": "F1 Dashboard API with Jolpica (Ergast)", "status": "running", "data_range": "1950-present"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=API_HOST, port=API_PORT)
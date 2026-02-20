import kbodata
import pandas as pd
from datetime import datetime
import json
import os
import argparse
import sys
import requests

# -----------------------------
# 1. Configuration & Constants
# -----------------------------

# Path to the JSON files
SCHEDULE_FILE_PATH = os.path.join("js", "schedule.json")
RANKINGS_FILE_PATH = os.path.join("js", "rankings.json")

# Use webdriver_manager to automatically handle driver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager


# Team Name Mapping (KBO Data Name -> Project Key)
# Based on js/constants.js
TEAM_MAP = {
    'LG': 'LG', 'LG 트윈스': 'LG',
    'KT': 'KT', 'KT 위즈': 'KT',
    'SSG': 'SSG', 'SSG 랜더스': 'SSG', 'SK': 'SSG',
    'NC': 'NC', 'NC 다이노스': 'NC',
    '두산': '두산', '두산 베어스': '두산', 'OB': '두산',
    'KIA': 'KIA', 'KIA 타이거즈': 'KIA', 'HT': 'KIA',
    '롯데': '롯데', '롯데 자이언츠': '롯데', 'LT': '롯데',
    '삼성': '삼성', '삼성 라이온즈': '삼성', 'SS': '삼성',
    '한화': '한화', '한화 이글스': '한화', 'HH': '한화',
    '키움': '키움', '키움 히어로즈': '키움', 'WO': '키움'
}

def get_team_key(team_name):
    """Maps various team name formats to the standard key used in constants.js"""
    # Remove extra spaces just in case
    clean_name = team_name.strip()
    return TEAM_MAP.get(clean_name, clean_name) # Return original if not found (for debugging)

# -----------------------------
# 2. Data Processing Functions
# -----------------------------

def process_game_data(df, note_suffix=None):
    """
    Transforms the raw DataFrame from kbodata to a list of dictionaries 
    matching the js/schedule.json format.
    """
    games_list = []

    # kbodata returns individual rows for each team in a game. 
    # We need to group them to form a single game entry.
    
    # Create a unique key to group by (Date + DoubleHeader status)
    # Note: We can't easily rely on just date for grouping because getting reliable home/away pairing 
    # from the flat list requires careful handling. 
    # Fortunately, kbodata output usually has 'home' and 'away' columns in the raw data 
    # BUT the `scoreboard_to_DataFrame` might restructure it. 
    # Let's inspect standard kbodata output structure assumption:
    # columns: year, month, day, week, time, team, r, h, e, b, place, audience, dbheader, home, away
    
    # It seems 'home' and 'away' columns exist in the dataframe returned by scoreboard_to_DataFrame
    
    if df.empty:
        return []

    # Create a grouping key
    df["group_key"] = (
        df["year"].astype(str) + 
        df["month"].astype(str).str.zfill(2) + 
        df["day"].astype(str).str.zfill(2) + 
        "_" + df["home"].astype(str) + "_" + df["away"].astype(str) +
        "_" + df["dbheader"].astype(str)
    )

    for key, group in df.groupby("group_key"):
        if group.empty:
            continue
            
        first_row = group.iloc[0]
        
        raw_home = first_row["home"]
        raw_away = first_row["away"]
        
        home_key = get_team_key(raw_home)
        away_key = get_team_key(raw_away)
        
        start_year = int(first_row["year"])
        start_month = int(first_row["month"])
        start_day = int(first_row["day"])
        
        # Parse Time if available, otherwise default
        try:
            time_str = first_row["time"]
            # expecting "18:30" format
            hour, minute = map(int, time_str.split(":"))
        except:
            hour, minute = 18, 30 # Default

        game_dt = datetime(start_year, start_month, start_day, hour, minute)
        start_iso = game_dt.strftime("%Y-%m-%dT%H:%M:%S")

        # Scores
        # group contains two rows: one for home team, one for away team.
        # We need to extract 'r' (runs) for the home team and away team.
        
        home_row = group[group["team"] == raw_home]
        away_row = group[group["team"] == raw_away]
        
        home_score = None
        away_score = None
        
        # Helper to safely get score
        def get_score(row_series):
            if len(row_series) > 0:
                val = row_series.iloc[0]["r"]
                # kbodata might return '-' or NaN for scheduled games
                if pd.isna(val) or val == '-' or str(val).strip() == '':
                    return None
                try:
                    return int(val)
                except:
                    return None
            return None

        home_score = get_score(home_row)
        away_score = get_score(away_row)
        
        # Generate ID: YYYYMMDD_HomeKey_AwayKey
        # Handling double headers in ID if necessary. 
        # Existing ID format in schedule.json seems to be YYYYMMDD_Home_Away
        # If double header, maybe force unique ID? 
        # For now, let's stick to simple format. 
        # If duplicate ID exists in same day (DH), we might need suffix.
        game_id = f"{start_year}{start_month:02d}{start_day:02d}_{home_key}_{away_key}"
        
        if first_row["dbheader"] > 0:
            game_id += f"_DH{int(first_row['dbheader'])}"

        # Status
        status = "scheduled" # default
        if home_score is not None and away_score is not None:
            status = "end"
        
        # Note
        note = ""
        stadium = first_row["place"]
        if stadium:
            note = str(stadium)
        if first_row["dbheader"] > 0:
             note += f" (DH{int(first_row['dbheader'])})"
        
        if note_suffix:
            if note:
                note += f" ({note_suffix})"
            else:
                note = note_suffix

        game_entry = {
            "id": game_id,
            "start": start_iso,
            "home_team": home_key,
            "away_team": away_key,
            "home_score": home_score,
            "away_score": away_score,
            "note": note,
            "status": status
        }
        
        games_list.append(game_entry)

    return games_list

def process_basic_schedule(df, note_suffix=None):
    """
    Fallback function to process basic schedule DataFrame when detailed game data is missing.
    Columns: status, date, home, away, dbheader, gameid
    """
    games_list = []
    
    if df.empty:
        return []

    for _, row in df.iterrows():
        raw_home = row["home"]
        raw_away = row["away"]
        
        home_key = get_team_key(raw_home)
        away_key = get_team_key(raw_away)
        
        # Parse Date (YYYYMMDD)
        date_str = str(row["date"])
        year = int(date_str[:4])
        month = int(date_str[4:6])
        day = int(date_str[6:8])
        
        # Default Time: 18:30 (Common KBO time)
        hour, minute = 18, 30 
        
        game_dt = datetime(year, month, day, hour, minute)
        start_iso = game_dt.strftime("%Y-%m-%dT%H:%M:%S")
        
        # Generate ID
        game_id = f"{year}{month:02d}{day:02d}_{home_key}_{away_key}"
        if row["dbheader"] > 0:
            game_id += f"_DH{int(row['dbheader'])}"
            
        game_entry = {
            "id": game_id,
            "start": start_iso,
            "home_team": home_key,
            "away_team": away_key,
            "home_score": None,
            "away_score": None,
            "note": note_suffix if note_suffix else "", # Use note_suffix if provided
            "status": "scheduled"
        }
        games_list.append(game_entry)
        
    return games_list

# -----------------------------
# 3. JSON Handling
# -----------------------------
# ... (rest of JSON functions are same, just ensuring correct placement)

def load_schedule():
    if not os.path.exists(SCHEDULE_FILE_PATH):
        return []
    try:
        with open(SCHEDULE_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"⚠️  Could not load existing schedule: {e}")
        return []

def save_schedule(data):
    try:
        with open(SCHEDULE_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"💾 Saved {len(data)} games to {SCHEDULE_FILE_PATH}")
    except Exception as e:
        print(f"❌ Failed to save schedule: {e}")

def update_rankings(target_year_str):
    print(f"🏆 Fetching KBO Rankings for {target_year_str}...")
    url = "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx"
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    from io import StringIO
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        dfs = pd.read_html(StringIO(response.text))
        
        if not dfs:
            print("❌ No ranking table found.")
            return

        df = dfs[0]
        
        # Parse logic
        new_rankings = []
        for _, row in df.iterrows():
            raw_team = str(row["팀명"]).strip()
            team_key = get_team_key(raw_team)
            
            try:
                rank = int(row["순위"])
            except:
                rank = str(row["순위"])
                
            try:
                games = int(row["경기"])
                win = int(row["승"])
                draw = int(row["무"])
                loss = int(row["패"])
                win_rate = float(row["승률"])
                game_diff = str(row["게임차"])
                streak = str(row["연속"])
            except ValueError:
                # Handle cases where data might be missing or non-numeric (e.g. before season starts)
                games, win, draw, loss, win_rate, game_diff, streak = 0, 0, 0, 0, 0.000, "0.0", "-"
                
            new_rankings.append({
                "rank": rank,
                "team": team_key,
                "games": games,
                "win": win,
                "draw": draw,
                "loss": loss,
                "win_rate": win_rate,
                "game_diff": game_diff,
                "streak": streak
            })
            
        # --- Off-season Protection Logic ---
        # If the total games played is 1440 or more (a full season), and we are in early months (Jan-Mar),
        # it is highly likely the KBO page is still showing the *previous* finished season's data.
        import datetime
        current_year = datetime.datetime.now().year
        current_month = datetime.datetime.now().month
        
        total_games = sum(t["games"] for t in new_rankings)
        if str(current_year) == target_year_str and total_games >= 1440 and current_month <= 3:
            print("⚠️ The fetched rankings appear to be from the previous finished season. Initializing with 0s.")
            for t in new_rankings:
                t["rank"] = "-"
                t["games"] = 0
                t["win"] = 0
                t["draw"] = 0
                t["loss"] = 0
                t["win_rate"] = 0.000
                t["game_diff"] = "0.0"
                t["streak"] = "-"
        # -----------------------------------
            
        # Load existing rankings.json
        existing_rankings = {}
        if os.path.exists(RANKINGS_FILE_PATH):
            with open(RANKINGS_FILE_PATH, 'r', encoding='utf-8') as f:
                try:
                    existing_rankings = json.load(f)
                except json.JSONDecodeError:
                    pass
                    
        # Replace the specific year's list
        existing_rankings[target_year_str] = new_rankings
        
        # Save back
        with open(RANKINGS_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing_rankings, f, indent=4, ensure_ascii=False)
            
        print(f"📊 Processed and saved {len(new_rankings)} ranking entries for {target_year_str}.")
        
    except Exception as e:
        print(f"❌ Failed to update rankings: {e}")

def update_schedule_data(existing_data, new_games):
    # Convert existing list to dict map by ID for easy update/upsert
    game_map = {game["id"]: game for game in existing_data}
    
    updates_count = 0
    new_count = 0
    
    for game in new_games:
        gid = game["id"]
        if gid in game_map:
            # Update existing
            # We preserve 'note' if it was manually edited? 
            # For now, let's assume we overwrite to keep sync with official source.
            game_map[gid].update(game)
            updates_count += 1
        else:
            # Insert new
            game_map[gid] = game
            new_count += 1
            
    # Convert back to list and sort by start time
    updated_list = list(game_map.values())
    updated_list.sort(key=lambda x: x["start"])
    
    print(f"📊 Processed: {new_count} new, {updates_count} updated.")
    return updated_list

# -----------------------------
# 4. Main Execution
# -----------------------------

def main():
    parser = argparse.ArgumentParser(description="Update KBO Schedule JSON")
    parser.add_argument("--year", type=int, default=datetime.now().year, help="Target Year")
    parser.add_argument("--month", type=int, default=datetime.now().month, help="Target Month")
    parser.add_argument("--note", type=str, default=None, help="Custom note to append (e.g. '시범경기')")
    args = parser.parse_args()

    target_year = args.year
    target_month = args.month
    custom_note = args.note

    print(f"⚾️ Fetching KBO Schedule for {target_year}-{target_month:02d}...")
    if custom_note:
        print(f"📝 Adding custom note: '{custom_note}'")

    try:
        # 1. Scraping
        # Install driver and get path
        driver_path = ChromeDriverManager().install()
        
        schedule = kbodata.get_monthly_schedule(target_year, target_month, driver_path)
        
        # Try getting detailed data first
        raw_data = kbodata.get_game_data(schedule, driver_path)
        df = kbodata.scoreboard_to_DataFrame(raw_data)
        
        new_games = []
        
        if not df.empty:
            print(f"✅ Detailed data found ({len(df)} records). Processing...")
            new_games = process_game_data(df, custom_note)
        elif not schedule.empty:
            print(f"⚠️ Detailed data broken/missing. Using basic schedule ({len(schedule)} records)...")
            new_games = process_basic_schedule(schedule, custom_note)
        else:
            print("❌ No data found.")
            return

        print(f"✅ Scraped {len(new_games)} games.")

        if not new_games:
            print("⚠️ No games found. Exiting.")
            return

        # 3. Updating JSON
        existing_data = load_schedule()
        updated_data = update_schedule_data(existing_data, new_games)
        save_schedule(updated_data)
        
        # 4. Updating Rankings JSON
        update_rankings(str(target_year))
        
        print("🎉 Update Complete!")

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
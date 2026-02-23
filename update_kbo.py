import json
import os
import argparse
import sys
import requests
from bs4 import BeautifulSoup
import pandas as pd
from io import StringIO
from datetime import datetime

# -----------------------------
# 1. Configuration & Constants
# -----------------------------

# Path to the JSON files
SCHEDULE_FILE_PATH = os.path.join("js", "schedule.json")
RANKINGS_FILE_PATH = os.path.join("js", "rankings.json")

# Team Name Mapping (KBO Data Name -> Project Key)
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
    clean_name = team_name.strip()
    return TEAM_MAP.get(clean_name, clean_name)

# -----------------------------
# 2. Data Processing Functions
# -----------------------------

def fetch_monthly_schedule_via_api(year, month, note_suffix=None):
    """
    Fetches the monthly schedule directly from KBO Ajax API, eliminating Selenium.
    Returns a list of game dictionaries matching js/schedule.json format.
    """
    url = 'https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList'
    data = {
        'leId': '1', # 1: KBO
        'srIdList': '0,1,2,3,4,5,7,9', # All series (Regular, Exhibition, Postseason)
        'seasonId': str(year),
        'gameMonth': f"{month:02d}",
        'teamId': ''
    }
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded'
    }

    try:
        response = requests.post(url, data=data, headers=headers)
        response.raise_for_status()
        data_json = response.json()
        rows = data_json.get('rows', [])
    except Exception as e:
        print("❌ API fetching error:", e)
        return []

    raw_games = []
    current_date_str = ""

    for r in rows:
        cells = r['row']
        if not cells:
            continue
            
        start_idx = 0
        if cells[0]['Class'] == 'day':
            day_text = BeautifulSoup(cells[0]['Text'], "html.parser").get_text().strip()
            # day_text example: "03.09(토)"
            current_date_str = day_text.split('(')[0]
            start_idx = 1
            
        if not current_date_str:
            continue
            
        # Example format: 03.09 -> month 3, day 9
        try:
            month_str, day_str = current_date_str.split('.')
            start_month = int(month_str)
            start_day = int(day_str)
        except Exception:
            continue
            
        time_text = BeautifulSoup(cells[start_idx]['Text'], "html.parser").get_text().strip()
        html_play = cells[start_idx + 1]['Text']
        soup = BeautifulSoup(html_play, "html.parser")
        spans = soup.find_all('span')
        
        away_score = None
        home_score = None
        away_team_raw = ""
        home_team_raw = ""
        status = "scheduled"
        
        if len(spans) >= 3:
            away_team_raw = spans[0].text.strip()
            home_team_raw = spans[-1].text.strip()
            
            em = soup.find('em')
            if em:
                score_spans = em.find_all('span')
                if len(score_spans) == 3 and 'vs' in score_spans[1].text:
                    away_score_str = score_spans[0].text.strip()
                    home_score_str = score_spans[2].text.strip()
                    if away_score_str.isdigit() and home_score_str.isdigit():
                        away_score = int(away_score_str)
                        home_score = int(home_score_str)
                        status = "end"
        
        stadium = BeautifulSoup(cells[start_idx + 6]['Text'], "html.parser").get_text().strip()
        api_note = BeautifulSoup(cells[start_idx + 7]['Text'], "html.parser").get_text().strip()
        
        if "취소" in api_note or "취소" in html_play:
            status = "canceled"
            
        try:
            hour, minute = map(int, time_text.split(':'))
        except:
            hour, minute = 18, 30
            
        game_dt = datetime(year, start_month, start_day, hour, minute)
        start_iso = game_dt.strftime("%Y-%m-%dT%H:%M:%S")
        
        home_key = get_team_key(home_team_raw)
        away_key = get_team_key(away_team_raw)
        
        if not home_key or not away_key:
            continue
            
        base_id = f"{year}{start_month:02d}{start_day:02d}_{home_key}_{away_key}"
        
        note_str = stadium
        if api_note and api_note != "-":
            note_str += f" ({api_note})"
        if note_suffix:
            note_str += f" ({note_suffix})"
            
        raw_games.append({
            "base_id": base_id,
            "id": base_id, # Will be adjusted if DH
            "start": start_iso,
            "home_team": home_key,
            "away_team": away_key,
            "home_score": home_score,
            "away_score": away_score,
            "note": note_str,
            "status": status
        })

    # Adjust Double Headers IDs
    from collections import Counter
    id_counts = Counter([g["base_id"] for g in raw_games])
    current_dh = {bid: 1 for bid in id_counts if id_counts[bid] > 1}
    
    games_list = []
    for g in raw_games:
        bid = g["base_id"]
        if id_counts[bid] > 1:
            dh_num = current_dh[bid]
            g["id"] = f"{bid}_DH{dh_num}"
            current_dh[bid] += 1
        del g["base_id"]
        games_list.append(g)

    return games_list

# -----------------------------
# 3. JSON Handling
# -----------------------------

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
        current_year = datetime.now().year
        current_month = datetime.now().month
        
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
    game_map = {game["id"]: game for game in existing_data}
    
    updates_count = 0
    new_count = 0
    
    for game in new_games:
        gid = game["id"]
        if gid in game_map:
            # Update existing
            game_map[gid].update(game)
            updates_count += 1
        else:
            # Insert new
            game_map[gid] = game
            new_count += 1
            
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
        new_games = fetch_monthly_schedule_via_api(target_year, target_month, custom_note)

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

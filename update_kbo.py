import kbodata
import pandas as pd
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
import math # NaN 체크용

# -----------------------------
# 1. 초기화
# -----------------------------
# 이미 초기화되어 있다면 건너뛰는 로직 추가 (Notebook 등에서 중복 실행 방지)
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase_key.json") # 경로 확인 필수!
    firebase_admin.initialize_app(cred)

db = firestore.client()

# -----------------------------
# 2. 데이터 처리 함수 (수정됨)
# -----------------------------
def merge_home_away(df):
    # 고유 ID 생성
    df["key"] = (
        df["year"].astype(str) +
        df["month"].astype(str).str.zfill(2) +
        df["day"].astype(str).str.zfill(2) +
        "_" + df["home"].astype(str) + "_" + df["away"].astype(str) 
        # dbheader(더블헤더)가 있으면 뒤에 붙임
        + df.apply(lambda x: "_" + str(int(x["dbheader"])) if x["dbheader"] > 0 else "", axis=1)
    )

    records = []
    
    # 경기별 그룹화
    for key, group in df.groupby("key"):
        home_team = group["home"].iloc[0]
        away_team = group["away"].iloc[0]

        # 점수 데이터 추출 (데이터가 없거나 NaN일 경우 처리)
        home_r_series = group[group["team"] == home_team]["r"]
        away_r_series = group[group["team"] == away_team]["r"]
        
        home_r = home_r_series.iloc[0] if len(home_r_series) > 0 else None
        away_r = away_r_series.iloc[0] if len(away_r_series) > 0 else None
        
        # Pandas의 NaN(Not a Number)을 None(Null)으로 변환
        if pd.isna(home_r): home_r = None
        if pd.isna(away_r): away_r = None

        # 🚨 수정 포인트 1: 점수가 없어도(None) 저장해야 함! (예정된 경기)
        # 상태(Status) 결정 로직
        game_status = "SCHEDULED"
        if home_r is not None and away_r is not None:
             game_status = "FINAL" # 혹은 취소된 경우 "CANCELED" 로직 추가 가능

        year = int(group["year"].iloc[0])
        month = int(group["month"].iloc[0])
        day = int(group["day"].iloc[0])

        # 🚨 수정 포인트 2: Firestore용 Timestamp 객체 생성
        # 시간 정보가 없다면 기본 00:00 또는 18:30 등으로 설정
        game_date = datetime(year, month, day, 18, 30) 

        record = {
            "gameId": key, # Flutter와 통일
            "date": game_date, # Timestamp로 저장됨
            "homeTeam": home_team,
            "awayTeam": away_team,
            "homeScore": int(home_r) if home_r is not None else 0, # 점수 없으면 0
            "awayScore": int(away_r) if away_r is not None else 0,
            "stadiumName": group["place"].iloc[0],
            "status": game_status, # SCHEDULED, FINAL
            "dbheader": int(group["dbheader"].iloc[0]),
        }
        records.append(record)

    return pd.DataFrame(records)

# -----------------------------
# 3. 메인 실행
# -----------------------------
if __name__ == "__main__":
    # 원하는 년/월 설정
    TARGET_YEAR = 2025
    TARGET_MONTH = 9
    
    # 드라이버 경로 (본인 환경에 맞게 수정)
    DRIVER_PATH = "/opt/homebrew/bin/chromedriver" 

    print(f"⚾️ {TARGET_YEAR}년 {TARGET_MONTH}월 경기 정보 가져오는 중...")
    
    try:
        # kbodata 라이브러리 사용
        schedule = kbodata.get_monthly_schedule(TARGET_YEAR, TARGET_MONTH, DRIVER_PATH)
        raw_data = kbodata.get_game_data(schedule, DRIVER_PATH)
        df_raw = kbodata.scoreboard_to_DataFrame(raw_data)
        
        # 데이터 병합 및 가공
        df_final = merge_home_away(df_raw)
        
        print(f"✅ 데이터 가공 완료! 총 {len(df_final)}개의 경기 발견.")
        print(df_final[['date', 'homeTeam', 'awayTeam', 'status']].head())

        # Firestore 업로드
        print("🔥 Firebase 업로드 시작...")
        
        batch = db.batch() # 배치 쓰기 (속도 및 비용 효율적)
        count = 0
        
        for _, row in df_final.iterrows():
            doc_ref = db.collection("games").document(row["gameId"])
            
            # DataFrame row를 딕셔너리로 변환
            doc_data = row.to_dict()
            
            # set(merge=True) : 기존 데이터(메모 등)를 지우지 않고 업데이트
            batch.set(doc_ref, doc_data, merge=True)
            count += 1
            
            # 배치 사이즈 제한(500개) 고려하여 커밋
            if count % 400 == 0:
                batch.commit()
                batch = db.batch()
                print(f"Running... {count}개 저장 중")

        batch.commit() # 남은 데이터 저장
        print(f"🎉 {TARGET_YEAR}년 {TARGET_MONTH}월 데이터 저장 완료! (총 {count}건)")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
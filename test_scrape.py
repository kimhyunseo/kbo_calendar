import pandas as pd
import requests

url = "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx"
headers = {'User-Agent': 'Mozilla/5.0'}
response = requests.get(url, headers=headers)
try:
    from io import StringIO
    dfs = pd.read_html(StringIO(response.text))
    if dfs:
        df = dfs[0]
        print(df.columns)
except Exception as e:
    print("Error:", e)

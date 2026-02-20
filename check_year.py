import requests
from bs4 import BeautifulSoup

url = "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx"
headers = {'User-Agent': 'Mozilla/5.0'}
response = requests.get(url, headers=headers)
soup = BeautifulSoup(response.text, 'html.parser')
# Find the selected option in the year dropdown
# The id is usually something like cphContents_cphContents_cphContents_ddlYear
selects = soup.find_all('select')
for s in selects:
    if 'Year' in s.get('id', ''):
        selected = s.find('option', selected=True)
        if selected:
            print("Selected Year:", selected.text)
            break

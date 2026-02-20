const fs = require('fs');
const path = require('path');
const axios = require('axios');

const SCHEDULE_PATH = path.join(__dirname, '../js/schedule.json');

// Naver Team Code -> Your App Team Name Mapping
const TEAM_MAP = {
    'LG': 'LG',
    'KT': 'KT',
    'SS': '삼성',
    'NC': 'NC',
    'OB': '두산', // Doosan is often 'OB' in legacy systems or 'DS'
    'HT': 'KIA', // KIA is often 'HT' (Haitai)
    'LT': '롯데',
    'HH': '한화',
    'WO': '키움', // Kiwoom is often 'WO' (Woori/Heroes)
    'SK': 'SSG'   // SSG is often 'SK'
};

// Reverse map for safety or additional checks if needed
const REVERSE_TEAM_MAP = Object.fromEntries(Object.entries(TEAM_MAP).map(([k, v]) => [v, k]));

// Helper to format date as YYYYMMDD
const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
};

async function updateSchedule() {
    console.log('Starting KBO schedule update...');

    try {
        // 1. Read existing schedule
        const rawData = fs.readFileSync(SCHEDULE_PATH, 'utf8');
        let schedule = JSON.parse(rawData);
        console.log(`Loaded ${schedule.length} games from local schedule.json`);

        // 2. Determine fetching range (e.g., current month)
        // For 2026 simulation, we might need to be careful. 
        // IF this is running in 2026, we fetch current month.
        // IF running now (2024/2025), fetching 2026 data might return nothing or placeholder.
        // *CRITICAL*: The user's schedule.json has 2026 dates. Naver might NOT have 2026 data yet.
        // However, the logic below is for the "Real" automation when 2026 comes, OR for testing now.

        const now = new Date();
        // Force April 2026 for testing if we are verifying logic, 
        // BUT for a real daily runner, it should be 'now'.
        // Let's use 'now' but print warnings if no data found.

        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

        // Naver API URL (Public endpoint used by their web frontend)
        // Note: '2026' data might not exist yet on Naver.
        const url = `https://api-gw.sports.naver.com/schedule/games?fields=basic,superMetrics&sportId=kbaseball&startDate=${currentYear}${currentMonth}01&endDate=${currentYear}${currentMonth}31`;

        console.log(`Fetching from: ${url}`);

        const response = await axios.get(url);
        const remoteGames = response.data.result.games;

        if (!remoteGames || remoteGames.length === 0) {
            console.log('No games found from API for this month.');
            return;
        }

        console.log(`Fetched ${remoteGames.length} games from API.`);

        let updatedCount = 0;

        // 3. Update Logic
        remoteGames.forEach(remoteGame => {
            // Naver Data Structure:
            // gameDateTime: "2024-04-12T18:30:00"
            // homeTeamCode: "LG", awayTeamCode: "KT"
            // homeTeamScore: 5, awayTeamScore: 3
            // gameStatus: "END" or "CANCEL"

            // Construct ID to match our local ID format: YYYYMMDD_HOME_AWAY
            // Our local ID: "20260328_LG_KT" (Note: Team codes in ID might differ from mapping)
            // Let's try to match by Date + Teams

            const gameDateStr = remoteGame.gameDateTime.split('T')[0].replace(/-/g, ''); // 20240412

            // Convert Naver Codes to Our Names
            const homeName = TEAM_MAP[remoteGame.homeTeamCode] || remoteGame.homeTeamName;
            const awayName = TEAM_MAP[remoteGame.awayTeamCode] || remoteGame.awayTeamName;

            // Find matching game in local schedule
            // We match by Date and Team Names because ID generation might vary
            const localGame = schedule.find(g =>
                g.start.startsWith(remoteGame.gameDateTime.split('T')[0]) &&
                g.home_team === homeName &&
                g.away_team === awayName
            );

            if (localGame) {
                let changed = false;

                // Update Scores
                if (remoteGame.homeTeamScore !== undefined && remoteGame.homeTeamScore !== localGame.home_score) {
                    localGame.home_score = remoteGame.homeTeamScore;
                    changed = true;
                }
                if (remoteGame.awayTeamScore !== undefined && remoteGame.awayTeamScore !== localGame.away_score) {
                    localGame.away_score = remoteGame.awayTeamScore;
                    changed = true;
                }

                // Update Status/Cancel (Optional: if we had a status field)
                // if (remoteGame.cancel && !localGame.canceled) ...

                if (changed) {
                    updatedCount++;
                    console.log(`Updated: ${localGame.id} (${remoteGame.gameStatus}) ${homeName} ${remoteGame.homeTeamScore} : ${remoteGame.awayTeamScore} ${awayName}`);
                }
            }
        });

        if (updatedCount > 0) {
            console.log(`\nUpdated total ${updatedCount} games.`);
            fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 4), 'utf8');
            console.log('Saved to schedule.json');
        } else {
            console.log('\nNo updates necessary.');
        }

    } catch (error) {
        console.error('Error in updater:', error.message);
        // Don't fail the build if it's just a 404 or empty data, but do log it.
        process.exit(1);
    }
}

updateSchedule();

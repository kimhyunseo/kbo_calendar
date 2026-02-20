import { DEFAULT_MASCOT_URL, KBO_TEAMS } from './constants.js';

/**
 * Creates the HTML content for a day cell in the calendar.
 * Marks "Home Games" with a specific style.
 */
export function createDayCellContent(arg, allScheduleData, currentSelectedTeam, appSettings) {
    const date = arg.date;
    let dayNumber = arg.dayNumberText.replace('일', '');



    let isHomeGame = false;
    let isExhibition = false;
    let isRegularSeason = false;

    if (appSettings) {
        // 날짜 문자열 한 번만 계산
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        if (appSettings.showHomeInfo) {
            isHomeGame = allScheduleData.some(game => {
                const gameDate = game.start.split('T')[0];
                return gameDate === dateString && game.home_team === currentSelectedTeam;
            });
        }

        if (appSettings.showExhibition) {
            // 시범 경기: note에 "시범" 포함
            isExhibition = allScheduleData.some(game => {
                const gameDate = game.start.split('T')[0];
                return gameDate === dateString
                    && (game.home_team === currentSelectedTeam || game.away_team === currentSelectedTeam)
                    && game.note && game.note.includes('시범');
            });

            // 정규 시즌: 경기가 있고 note에 "시범"이 없으면 초록 점 (note 없어도 OK)
            isRegularSeason = allScheduleData.some(game => {
                const gameDate = game.start.split('T')[0];
                const noteValue = game.note || '';
                return gameDate === dateString
                    && (game.home_team === currentSelectedTeam || game.away_team === currentSelectedTeam)
                    && !noteValue.includes('시범');
            });
        }
    }

    // position: relative 컨테이너 - 날짜는 정중앙 절대 위치, 시범은 왼쪽 절대 위치
    let html = `<div class="w-full pt-1" style="position: relative; height: 28px;">`;

    // 시범 점: 연한 노란색 (시범 경기)
    if (isExhibition) {
        html += `<span style="position: absolute; left: 2px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background-color: #fcd34d; display: inline-block; box-shadow: 0 0 0 2px #fefce8;"></span>`;
    }

    // 정규 시즌 점: 연한 초록색 (정규 경기)
    if (isRegularSeason) {
        html += `<span style="position: absolute; left: 2px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background-color: #86efac; display: inline-block; box-shadow: 0 0 0 2px #f0fdf4;"></span>`;
    }

    // 날짜 숫자: 항상 정중앙 절대 위치 (모바일: w-5, 데스크탑: w-6)
    if (isHomeGame) {
        html += `<span class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 font-bold text-xs sm:text-sm shadow-sm" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">${dayNumber}</span>`;
    } else {
        html += `<span class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full text-gray-700 font-medium text-xs sm:text-sm" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">${dayNumber}</span>`;
    }

    html += `</div>`;

    return { html: html };
}

/**
 * Creates the HTML content for an event (match) in the day grid.
 * Displays mascots and win/loss badges.
 */
export function createEventContent(arg, currentSelectedTeam, appSettings) {
    const event = arg.event.extendedProps;
    const isHomeTeamSelected = event.home_team === currentSelectedTeam;
    const showResult = appSettings ? appSettings.showResult : true;
    const showTime = appSettings ? appSettings.showTime : true;

    // Determine which mascot to show (Aggressor/Opponent)
    let mascotUrl = '';
    let altText = '';
    if (isHomeTeamSelected) {
        mascotUrl = event.away_mascot_url;
        altText = event.away_team; // Show opponent
    } else {
        mascotUrl = event.home_mascot_url;
        altText = event.home_team; // Show opponent
    }

    // Result Logic (Win/Loss/Draw)
    const hasScore = typeof event.home_score === 'number' && typeof event.away_score === 'number';
    let badgeHtml = '';

    if (hasScore) {
        let result = ''; // Win/Loss/Draw from MY perspective
        let myScore, oppScore;

        if (isHomeTeamSelected) {
            myScore = event.home_score;
            oppScore = event.away_score;
        } else {
            myScore = event.away_score;
            oppScore = event.home_score;
        }

        if (myScore > oppScore) result = 'WIN';
        else if (myScore < oppScore) result = 'LOSE';
        else result = 'DRAW';

        // Apply Visuals
        const opponentTeamKey = isHomeTeamSelected ? event.away_team : event.home_team;
        const teamSlug = KBO_TEAMS[opponentTeamKey]?.slug;

        // Ensure default mascots are set effectively if result visuals are skipped or result is neutral
        if (result === 'WIN' && showResult) {
            // My team won -> Opponent gets _lose image (Crying)
            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_lose.png`;
            badgeHtml = `<span class="mt-2 bg-rose-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">승리</span>`;
        } else if (result === 'LOSE' && showResult) {
            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_win.png`;
            badgeHtml = `<span class="mt-2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">패배</span>`;
        } else if (result === 'DRAW' && showResult) {
            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_tie.png`;
            badgeHtml = `<span class="mt-2 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">무승부</span>`;
        }
    } else {
        // No score yet (Future game)
        // Show Time Badge ONLY if showTime is true
        if (showTime) {
            const timeString = arg.event.start.toLocaleTimeString('ko-KR', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            badgeHtml = `<span class="mt-2 bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 border border-gray-200">${timeString}</span>`;
        } else {
            // Nothing to show (just mascot)
            badgeHtml = '';
        }
    }

    return {
        html: `
        <div class="relative flex flex-col items-center justify-center w-full h-full pb-1 hover:scale-105 transition-transform duration-200">
             <img src="${mascotUrl}" class="w-10 h-10 sm:w-14 sm:h-14 object-contain drop-shadow-sm" alt="${altText}" onerror="this.src='${DEFAULT_MASCOT_URL}'">
             ${badgeHtml}
        </div>
        `
    };
}

/**
 * Generates the HTML string for the event details view.
 */
export function generateEventDetailsHtml(info, currentSelectedTeam) {
    const eventData = info.event.extendedProps;
    const homeTeamName = KBO_TEAMS[eventData.home_team]?.name || eventData.home_team;
    const awayTeamName = KBO_TEAMS[eventData.away_team]?.name || eventData.away_team;
    const hasScore = typeof eventData.home_score === 'number' && typeof eventData.away_score === 'number';

    // --- Result Logic for Details ---
    let homeMascotUrl = eventData.home_mascot_url;
    let awayMascotUrl = eventData.away_mascot_url;

    if (hasScore) {
        const homeSlug = KBO_TEAMS[eventData.home_team]?.slug;
        const awaySlug = KBO_TEAMS[eventData.away_team]?.slug;

        // Tie
        if (eventData.home_score === eventData.away_score) {
            if (homeSlug) homeMascotUrl = `assets/images/${homeSlug}_tie.png`;
            if (awaySlug) awayMascotUrl = `assets/images/${awaySlug}_tie.png`;
        }
        // Home Win
        else if (eventData.home_score > eventData.away_score) {
            if (homeSlug) homeMascotUrl = `assets/images/${homeSlug}_win.png`;
            if (awaySlug) awayMascotUrl = `assets/images/${awaySlug}_lose.png`;
        }
        // Away Win
        else {
            if (homeSlug) homeMascotUrl = `assets/images/${homeSlug}_lose.png`;
            if (awaySlug) awayMascotUrl = `assets/images/${awaySlug}_win.png`;
        }
    }

    const isExhibitionGame = eventData.note && eventData.note.includes('시범');
    const gameTypeBadge = isExhibitionGame
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-bold text-xs"><span style="width:6px;height:6px;border-radius:50%;background:#fcd34d;display:inline-block;"></span>시범 경기</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-bold text-xs"><span style="width:6px;height:6px;border-radius:50%;background:#86efac;display:inline-block;"></span>정규 시즌</span>`;

    return `
        <div class="flex flex-col gap-6">
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-gray-500 font-medium">
                    ${info.event.start.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                </span>
                ${gameTypeBadge}
            </div>

            <div class="flex items-center justify-between px-4 sm:px-10">
                <!-- Home -->
                <div class="flex flex-col items-center gap-2 w-1/3">
                    <div class="relative w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 shadow-inner">
                        <img src="${homeMascotUrl}" alt="${homeTeamName}" class="w-14 h-14 object-contain" onerror="this.src='${KBO_TEAMS[eventData.home_team]?.mascot || DEFAULT_MASCOT_URL}'">
                    </div>
                    <span class="font-bold text-gray-900 text-lg">${homeTeamName}</span>
                    <span class="text-xs font-semibold text-gray-400 tracking-wider">HOME</span>
                </div>

                <!-- Score / Status -->
                <div class="flex flex-col items-center justify-center w-1/3 gap-2">
                    ${hasScore ? `
                        <span class="text-2xl font-bold text-gray-900">${eventData.home_score} : ${eventData.away_score}</span>
                        <span class="text-xs text-gray-400 font-medium">최종 결과</span>
                    ` : `
                        <span class="px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 font-bold text-sm">경기 전</span>
                    `}
                </div>

                <!-- Away -->
                <div class="flex flex-col items-center gap-2 w-1/3">
                    <div class="relative w-20 h-20 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-sm">
                        <img src="${awayMascotUrl}" alt="${awayTeamName}" class="w-14 h-14 object-contain" onerror="this.src='${KBO_TEAMS[eventData.away_team]?.mascot || DEFAULT_MASCOT_URL}'">
                    </div>
                    <span class="font-bold text-gray-900 text-lg">${awayTeamName}</span>
                    <span class="text-xs font-semibold text-gray-400 tracking-wider">AWAY</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generates the HTML string for the rankings table rows.
 */
export function generateRankingsHtml(rankingsData, currentSelectedTeam) {
    if (!rankingsData || rankingsData.length === 0) {
        return `<tr><td colspan="9" class="py-8 text-gray-400">순위 데이터가 없습니다.</td></tr>`;
    }

    let html = '';
    rankingsData.forEach(teamData => {
        // 내 응원팀 하이라이트용
        const isMyTeam = (teamData.team === currentSelectedTeam);
        const rowClass = isMyTeam ? 'bg-blue-50/50 font-bold border-l-4 border-l-blue-500' : 'hover:bg-gray-50/50 border-l-4 border-l-transparent border-b border-gray-50 transition-colors';
        const teamTextColor = isMyTeam ? 'text-blue-700' : 'text-gray-900 font-bold';

        // 팀 로고 (Constant 활용)
        const teamKey = teamData.team;
        const mascotUrl = KBO_TEAMS[teamKey]?.mascot || DEFAULT_MASCOT_URL;

        // 순위 표시 (1, 2, 3위는 색상 강조)
        let rankBadge = `<span class="text-gray-600 font-medium">${teamData.rank}</span>`;
        if (teamData.rank === 1) rankBadge = `<span class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-yellow-100 text-yellow-700 font-bold text-sm">1</span>`;
        else if (teamData.rank === 2) rankBadge = `<span class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-gray-200 text-gray-700 font-bold text-sm">2</span>`;
        else if (teamData.rank === 3) rankBadge = `<span class="inline-flex w-6 h-6 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-bold text-sm">3</span>`;

        // 연승/연패 배지 색상 처리
        let streakClass = 'text-gray-500';
        if (teamData.streak.includes('승')) streakClass = 'text-rose-500 font-bold';
        else if (teamData.streak.includes('패')) streakClass = 'text-blue-500 font-bold';

        html += `
            <tr class="${rowClass}">
                <td class="py-3 px-2">${rankBadge}</td>
                <td class="py-3 px-4 text-left flex items-center gap-2 min-w-[120px]">
                    <img src="${mascotUrl}" alt="${teamData.team}" class="w-6 h-6 object-contain" onerror="this.src='${DEFAULT_MASCOT_URL}'">
                    <span class="${teamTextColor}">${KBO_TEAMS[teamKey]?.name || teamKey}</span>
                </td>
                <td class="py-3 px-2 text-gray-600">${teamData.games}</td>
                <td class="py-3 px-2 text-gray-600">${teamData.win}</td>
                <td class="py-3 px-2 text-gray-600">${teamData.draw}</td>
                <td class="py-3 px-2 text-gray-600">${teamData.loss}</td>
                <td class="py-3 px-2 text-gray-800 font-semibold">${teamData.win_rate.toFixed(3)}</td>
                <td class="py-3 px-2 text-gray-600">${teamData.game_diff}</td>
                <td class="py-3 px-2 ${streakClass}">${teamData.streak}</td>
            </tr>
        `;
    });

    return html;
}

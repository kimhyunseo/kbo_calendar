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

    if (appSettings) {
        if (appSettings.showHomeInfo) {
            // Logic to find if it's a home game
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;

            isHomeGame = allScheduleData.some(game => {
                const gameDate = game.start.split('T')[0];
                return gameDate === dateString && game.home_team === currentSelectedTeam;
            });
        }

        if (appSettings.showExhibition) {
            // Check if ANY game today is exhibition
            // Optimization: We could pass the day's events in arg, but fullcalendar dayCellContent arg doesn't have events directly easily without loop.
            // Re-using the same loop as above or similar.
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;

            isExhibition = allScheduleData.some(game => {
                const gameDate = game.start.split('T')[0];
                return gameDate === dateString && (game.home_team === currentSelectedTeam || game.away_team === currentSelectedTeam) && (game.note && game.note.includes("시범"));
            });
        }
    }

    // Modern "Home Game" indicator
    let html = `<div class="flex flex-col items-center justify-start h-full w-full pt-1">`;

    // Badge + Date Layout (Grid for perfect centering)
    // Left: Badge, Center: Date, Right: Empty
    html += `<div class="grid grid-cols-3 items-center w-full mb-1 px-1">`;

    // Left Column: Badge
    html += `<div class="flex justify-start">`;
    if (isExhibition) {
        html += `<span class="bg-amber-100 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none shadow-sm whitespace-nowrap">시범</span>`;
    }
    html += `</div>`;

    // Center Column: Date
    html += `<div class="flex justify-center">`;
    if (isHomeGame) {
        html += `
            <span class="w-7 h-7 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 font-bold text-sm shadow-sm z-0 shrink-0">${dayNumber}</span>
        `;
    } else {
        html += `<span class="w-7 h-7 flex items-center justify-center rounded-full text-gray-700 font-medium text-sm z-0 shrink-0">${dayNumber}</span>`;
    }
    html += `</div>`;

    // Right Column: Empty (Spacer to balance layout)
    html += `<div class="flex justify-end"></div>`;

    html += `</div>`; // Close grid container
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
            badgeHtml = `<span class="mt-1 bg-rose-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">승리</span>`;
        } else if (result === 'LOSE' && showResult) {
            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_win.png`;
            badgeHtml = `<span class="mt-1 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">패배</span>`;
        } else if (result === 'DRAW' && showResult) {
            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_tie.png`;
            badgeHtml = `<span class="mt-1 bg-slate-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">무승부</span>`;
        }
    } else {
        // No score yet (Future game)
        // Show Time Badge ONLY if showTime is true
        if (showTime) {
            const timeString = arg.event.start.toLocaleTimeString('ko-KR', {
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            badgeHtml = `<span class="mt-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 border border-gray-200">${timeString}</span>`;
        } else {
            // Nothing to show (just mascot)
            badgeHtml = '';
        }
    }

    return {
        html: `
        <div class="relative flex flex-col items-center justify-center w-full h-full pb-2 hover:scale-105 transition-transform duration-200">
             <img src="${mascotUrl}" class="w-10 h-10 sm:w-16 sm:h-16 object-contain drop-shadow-sm" alt="${altText}" onerror="this.src='${DEFAULT_MASCOT_URL}'">
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

    return `
        <div class="flex flex-col gap-6">
            <div class="text-sm text-gray-500 font-medium">
                ${info.event.start.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })}
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

                <!-- Score -->
                <div class="flex flex-col items-center justify-center w-1/3">
                    ${hasScore ? `
                        </div>
                    ` : `
                        <div class="flex flex-col items-center gap-1">
                            ${eventData.note === "시범 경기"
            ? `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-600 font-bold text-xs">시범 경기</span>`
            : `<span class="px-3 py-1 rounded-full bg-blue-50 text-blue-600 font-bold text-sm">경기 전</span>`
        }
                        </div>
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

document.addEventListener('DOMContentLoaded', function () {

    // --- [1. Configuration & Data] ---
    const DEFAULT_MASCOT_URL = 'https://placehold.co/32x32?text=NA';
    const KBO_TEAMS = {
        'LG': { name: 'LG 트윈스', mascot: 'assets/images/lg.png', slug: 'lg' },
        'KT': { name: 'KT 위즈', mascot: 'assets/images/kt.png', slug: 'kt' },
        'SSG': { name: 'SSG 랜더스', mascot: 'assets/images/ssg.png', slug: 'ssg' },
        'NC': { name: 'NC 다이노스', mascot: 'assets/images/nc.png', slug: 'nc' },
        '두산': { name: '두산 베어스', mascot: 'assets/images/doosan.png', slug: 'doosan' },
        'KIA': { name: 'KIA 타이거즈', mascot: 'assets/images/kia.png', slug: 'kia' },
        '롯데': { name: '롯데 자이언츠', mascot: 'assets/images/lotte.png', slug: 'lotte' },
        '삼성': { name: '삼성 라이온즈', mascot: 'assets/images/samsung.png', slug: 'samsung' },
        '한화': { name: '한화 이글스', mascot: 'assets/images/hanwha.png', slug: 'hanwha' },
        '키움': { name: '키움 히어로즈', mascot: 'assets/images/kiwoom.png', slug: 'kiwoom' }
    };

    // DOM Elements
    const calendarEl = document.getElementById('calendar');
    const teamSelectEl = document.getElementById('team-select');
    const eventDetailsContainerEl = document.getElementById('event-details-container');
    const eventDetailsEl = document.getElementById('event-details');

    // State
    let currentSelectedTeam = '';

    // Initialize Team Selector
    Object.keys(KBO_TEAMS).forEach((teamKey, index) => {
        const option = document.createElement('option');
        option.value = teamKey;
        option.textContent = KBO_TEAMS[teamKey].name;
        teamSelectEl.appendChild(option);
        if (index === 0) currentSelectedTeam = teamKey;
    });
    teamSelectEl.value = currentSelectedTeam;

    // --- [2. Helper Functions] ---

    // Custom Icons for Buttons
    const updateNavIcons = () => {
        const prevBtn = document.querySelector('.fc-prev-button');
        const nextBtn = document.querySelector('.fc-next-button');

        if (prevBtn) prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
        if (nextBtn) nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
    };

    // Fetch Data
    fetch('./js/schedule.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(fetchedScheduleData => {
            // Pre-process data
            const allScheduleData = fetchedScheduleData.map(game => ({
                ...game,
                home_mascot_url: KBO_TEAMS[game.home_team]?.mascot || DEFAULT_MASCOT_URL,
                away_mascot_url: KBO_TEAMS[game.away_team]?.mascot || DEFAULT_MASCOT_URL
            }));

            // Filter logic
            const getFilteredEvents = (selectedTeam) => {
                return allScheduleData.filter(game =>
                    game.home_team === selectedTeam || game.away_team === selectedTeam
                );
            };

            // --- [3. Calendar Initialization] ---
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                firstDay: 1, // Start week on Monday
                height: 'auto',
                fixedWeekCount: false,
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listWeek'
                },
                locale: 'ko',
                buttonText: {
                    today: '오늘',
                    month: '월',
                    list: '주'
                },
                titleFormat: { month: 'long' }, // Year removed
                dayCellContent: function (arg) {
                    const date = arg.date;
                    let dayNumber = arg.dayNumberText.replace('일', '');

                    // Logic to find if it's a home game
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateString = `${year}-${month}-${day}`;

                    const isHomeGame = allScheduleData.some(game => {
                        const gameDate = game.start.split('T')[0];
                        return gameDate === dateString && game.home_team === currentSelectedTeam;
                    });

                    // Modern "Home Game" indicator
                    let html = `<div class="flex flex-col items-center justify-start h-full w-full">`;

                    if (isHomeGame) {
                        html += `
                            <span class="w-7 h-7 flex items-center justify-center rounded-full bg-rose-50 text-rose-600 font-bold text-sm shadow-sm mb-1">${dayNumber}</span>
                        `;
                    } else {
                        html += `<span class="w-7 h-7 flex items-center justify-center rounded-full text-gray-700 font-medium text-sm mb-1">${dayNumber}</span>`;
                    }
                    html += `</div>`;

                    return { html: html };
                },
                events: function (fetchInfo, successCallback, failureCallback) {
                    successCallback(getFilteredEvents(currentSelectedTeam));
                },
                eventContent: function (arg) {
                    const event = arg.event.extendedProps;
                    const isHomeTeamSelected = event.home_team === currentSelectedTeam;

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
                    let resultEffectClass = '';

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

                        if (result === 'WIN') {
                            // My team won -> Opponent gets _lose image (Crying)
                            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_lose.png`;
                            resultEffectClass = 'opacity-100';
                        } else if (result === 'LOSE') {
                            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_win.png`;
                        } else {
                            if (teamSlug) mascotUrl = `assets/images/${teamSlug}_tie.png`;
                        }
                    }

                    return {
                        html: `
                        <div class="flex flex-col items-center justify-center w-full h-full pb-2 hover:scale-105 transition-transform duration-200">
                             <img src="${mascotUrl}" class="w-10 h-10 sm:w-12 sm:h-12 object-contain drop-shadow-sm ${resultEffectClass}" alt="${altText}" onerror="this.src='${DEFAULT_MASCOT_URL}'">
                        </div>
                        `
                    };
                },
                // Triggered after view render (good for icons)
                datesSet: function () {
                    updateNavIcons();
                },
                eventClick: function (info) {
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

                    eventDetailsEl.innerHTML = `
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
                                        <div class="flex items-center gap-3 text-4xl sm:text-5xl font-black text-gray-900 tracking-tighter">
                                            <span>${eventData.home_score}</span>
                                            <span class="text-gray-300 text-3xl">:</span>
                                            <span>${eventData.away_score}</span>
                                        </div>
                                    ` : `<div class="px-4 py-2 rounded-full bg-blue-50 text-blue-600 font-bold text-sm">경기 전</div>`}
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
                    eventDetailsContainerEl.classList.remove('hidden');
                    // Smooth scroll to details
                    eventDetailsContainerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            calendar.render();
            // Initial Icon Update
            updateNavIcons();

            // Event Listeners
            teamSelectEl.addEventListener('change', function () {
                currentSelectedTeam = this.value;
                calendar.refetchEvents();
                eventDetailsContainerEl.classList.add('hidden');
            });
        })
        .catch(error => {
            console.error('Error:', error);
            calendarEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                    <svg class="w-12 h-12 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                    <p>일정 데이터를 불러오지 못했습니다.</p>
                </div>`;
        });
});

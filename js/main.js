import { DEFAULT_MASCOT_URL, KBO_TEAMS } from './constants.js';
import { createDayCellContent, createEventContent, generateEventDetailsHtml } from './renderers.js';

document.addEventListener('DOMContentLoaded', function () {

    // --- [1. Configuration & Data] ---
    // Constants imported from constants.js

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
                    return createDayCellContent(arg, allScheduleData, currentSelectedTeam);
                },
                events: function (fetchInfo, successCallback, failureCallback) {
                    successCallback(getFilteredEvents(currentSelectedTeam));
                },
                eventContent: function (arg) {
                    return createEventContent(arg, currentSelectedTeam);
                },
                // Triggered after view render (good for icons)
                datesSet: function () {
                    updateNavIcons();
                },
                eventClick: function (info) {
                    eventDetailsEl.innerHTML = generateEventDetailsHtml(info, currentSelectedTeam);
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

import { DEFAULT_MASCOT_URL, KBO_TEAMS } from './constants.js';
import { createDayCellContent, createEventContent, generateEventDetailsHtml } from './renderers.js';

document.addEventListener('DOMContentLoaded', function () {

    // --- [1. Configuration & Data] ---
    // DOM Elements
    const calendarEl = document.getElementById('calendar');
    const teamSelectEl = document.getElementById('team-select');
    const eventDetailsContainerEl = document.getElementById('event-details-container');
    const eventDetailsEl = document.getElementById('event-details');

    // --- [Settings State & UI] ---
    const appSettings = {
        showHomeInfo: true,
        showExhibition: true,
        showResult: true,
        showTime: true
    };

    // Settings DOM Elements
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const settingsModalContent = document.getElementById('settings-modal-content');

    const toggleHomeInfo = document.getElementById('toggle-home-info');
    const toggleExhibition = document.getElementById('toggle-exhibition');
    const toggleResult = document.getElementById('toggle-result');
    const toggleTime = document.getElementById('toggle-time');

    // Modal Logic
    const openSettings = () => {
        settingsModal.classList.remove('hidden');
        setTimeout(() => {
            settingsModal.classList.remove('opacity-0');
            settingsModalContent.classList.remove('scale-95');
            settingsModalContent.classList.add('scale-100');
        }, 10);
    };

    const closeSettings = () => {
        settingsModal.classList.add('opacity-0');
        settingsModalContent.classList.remove('scale-100');
        settingsModalContent.classList.add('scale-95');
        setTimeout(() => {
            settingsModal.classList.add('hidden');
        }, 300);
    };

    settingsBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettings();
    });

    // Helper for Icons
    const updateNavIcons = () => {
        const prevBtn = document.querySelector('.fc-prev-button');
        const nextBtn = document.querySelector('.fc-next-button');

        if (prevBtn) prevBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>`;
        if (nextBtn) nextBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>`;
    };

    // State
    let currentSelectedTeam = '';
    let calendar = null; // Declare calendar here

    // Initialize Team Selector
    Object.keys(KBO_TEAMS).forEach((teamKey, index) => {
        const option = document.createElement('option');
        option.value = teamKey;
        option.textContent = KBO_TEAMS[teamKey].name;
        teamSelectEl.appendChild(option);
        if (index === 0) currentSelectedTeam = teamKey;
    });
    teamSelectEl.value = currentSelectedTeam;

    // Toggle Listeners (Defined here but check for calendar existence)
    toggleHomeInfo.addEventListener('change', (e) => {
        appSettings.showHomeInfo = e.target.checked;
        if (calendar) {
            calendar.render();
            updateNavIcons();
        }
    });

    toggleExhibition.addEventListener('change', (e) => {
        appSettings.showExhibition = e.target.checked;
        if (calendar) calendar.refetchEvents();
    });

    toggleResult.addEventListener('change', (e) => {
        appSettings.showResult = e.target.checked;
        if (calendar) {
            calendar.render();
            updateNavIcons();
        }
    });

    toggleTime.addEventListener('change', (e) => {
        appSettings.showTime = e.target.checked;
        if (calendar) {
            calendar.render();
            updateNavIcons();
        }
    });

    // --- [Data Fetching & Calendar Init] ---
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
                return allScheduleData.filter(game => {
                    // 1. Team Filter
                    const isMyTeam = game.home_team === selectedTeam || game.away_team === selectedTeam;
                    if (!isMyTeam) return false;

                    // 2. Exhibition Filter
                    if (!appSettings.showExhibition) {
                        if (game.note && game.note.includes("시범")) return false;
                    }

                    return true;
                });
            };

            // Initialize Calendar
            calendar = new FullCalendar.Calendar(calendarEl, {
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
                    return createDayCellContent(arg, allScheduleData, currentSelectedTeam, appSettings);
                },
                events: function (fetchInfo, successCallback, failureCallback) {
                    successCallback(getFilteredEvents(currentSelectedTeam));
                },
                eventContent: function (arg) {
                    return createEventContent(arg, currentSelectedTeam, appSettings);
                },
                datesSet: function () {
                    updateNavIcons();
                },
                eventClick: function (info) {
                    eventDetailsEl.innerHTML = generateEventDetailsHtml(info, currentSelectedTeam);
                    eventDetailsContainerEl.classList.remove('hidden');
                    eventDetailsContainerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });

            calendar.render();
            updateNavIcons();

            // Team Select Listener
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

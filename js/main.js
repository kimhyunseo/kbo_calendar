document.addEventListener('DOMContentLoaded', function () {

    // --- [1. 데이터 설계] ---
    const DEFAULT_MASCOT_URL = 'https://placehold.co/32x32?text=NA';
    const kboTeams = {
        'LG': { name: 'LG 트윈스', mascot: 'assets/images/lg_lucky.png' },
        'KT': { name: 'KT 위즈', mascot: 'assets/images/kt_ddori.png' },
        'SSG': { name: 'SSG 랜더스', mascot: 'assets/images/ssg_randy.png' },
        'NC': { name: 'NC 다이노스', mascot: 'assets/images/nc_dandi.png' },
        '두산': { name: '두산 베어스', mascot: 'assets/images/doosan_cheolwoong.png' },
        'KIA': { name: 'KIA 타이거즈', mascot: 'assets/images/kia_hogeol.png' },
        '롯데': { name: '롯데 자이언츠', mascot: 'assets/images/lotte_pini.png' },
        '삼성': { name: '삼성 라이온즈', mascot: 'assets/images/samsung_bleo.png' },
        '한화': { name: '한화 이글스', mascot: 'assets/images/hanwha_suri.png' },
        '키움': { name: '키움 히어로즈', mascot: 'assets/images/kiwoom_tukdol.png' }
    };

    // DOM 요소 참조
    const calendarEl = document.getElementById('calendar');
    const teamSelectEl = document.getElementById('team-select');
    const eventDetailsContainerEl = document.getElementById('event-details-container');
    const eventDetailsEl = document.getElementById('event-details');

    // --- [전역 상태 관리] 현재 선택된 팀 ---
    let currentSelectedTeam = '';

    // <select>에 KBO 팀 옵션 추가 (초기 선택 팀 설정)
    const teamKeys = Object.keys(kboTeams);
    teamKeys.forEach((teamKey, index) => {
        const option = document.createElement('option');
        option.value = teamKey;
        option.textContent = kboTeams[teamKey].name;
        teamSelectEl.appendChild(option);
        if (index === 0) { // 첫 번째 팀을 기본 선택
            currentSelectedTeam = teamKey;
        }
    });
    teamSelectEl.value = currentSelectedTeam; // select UI에 초기값 반영

    // schedule.json 파일에서 데이터를 불러와서 캘린더를 초기화합니다.
    fetch('./js/schedule.json') // <-- 경로 수정!
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(fetchedScheduleData => {
            const allScheduleData = fetchedScheduleData.map(game => ({
                ...game,
                home_mascot_url: kboTeams[game.home_team]?.mascot || DEFAULT_MASCOT_URL,
                away_mascot_url: kboTeams[game.away_team]?.mascot || DEFAULT_MASCOT_URL
            }));

            // 선택된 팀의 경기만 필터링하는 함수
            const getFilteredEvents = (selectedTeam) => {
                return allScheduleData.filter(game =>
                    game.home_team === selectedTeam || game.away_team === selectedTeam
                );
            };

            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                initialDate: '2026-04-01',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listWeek'
                },
                locale: 'ko',
                // events 콜백을 사용하여 필터링된 이벤트를 제공
                events: function (fetchInfo, successCallback, failureCallback) {
                    successCallback(getFilteredEvents(currentSelectedTeam));
                },
                eventDisplay: 'block',

                // --- [UX 개선] eventContent 리팩토링 ---
                eventContent: function (arg) {
                    const event = arg.event.extendedProps;

                    const isHomeTeamSelected = event.home_team === currentSelectedTeam;
                    const isAwayTeamSelected = event.away_team === currentSelectedTeam;

                    let mascotUrl = '';
                    let altText = '';
                    // 선택된 팀 기준으로 상대팀 마스코트만 표시
                    if (isHomeTeamSelected) {
                        mascotUrl = event.away_mascot_url;
                        altText = event.away_team;
                    } else if (isAwayTeamSelected) {
                        mascotUrl = event.home_mascot_url;
                        altText = event.home_team;
                    } else {
                        return false;
                    }

                    let resultBadgeHtml = '';
                    let homeIconHtml = '';

                    // 1. 승/패/무 뱃지: 점수가 있고, 선택된 팀의 경기인 경우에만 표시
                    const hasScore = typeof event.home_score === 'number' && typeof event.away_score === 'number';
                    if (hasScore) {
                        let result = '';
                        if (isHomeTeamSelected) {
                            if (event.home_score > event.away_score) result = 'W';
                            else if (event.home_score < event.away_score) result = 'L';
                            else result = 'D';
                        } else if (isAwayTeamSelected) {
                            if (event.away_score > event.home_score) result = 'W';
                            else if (event.away_score < event.home_score) result = 'L';
                            else result = 'D';
                        }

                        if (result) {
                            const badgeColor = result === 'W' ? 'bg-blue-600' : (result === 'L' ? 'bg-red-600' : 'bg-gray-500');
                            resultBadgeHtml = `<span class="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold ${badgeColor} rounded-full w-4 h-4 flex items-center justify-center shadow-md">${result}</span>`;
                        }
                    }

                    // 2. 홈 아이콘: 선택된 팀의 홈 경기일 때만 표시
                    if (isHomeTeamSelected) {
                        homeIconHtml = `<span class="absolute -bottom-1 -left-1 bg-white/80 backdrop-blur-sm rounded-full w-4 h-4 flex items-center justify-center text-[10px] shadow-md">🏠</span>`;
                    }

                    // 3. 최종 HTML 조합
                    const innerHtml = `
                        <div class="relative flex justify-center items-center w-full h-full p-1">
                            <img src="${mascotUrl}" alt="${altText}" class="w-8 h-8 object-contain" onerror="this.src='${DEFAULT_MASCOT_URL}'">
                            ${resultBadgeHtml}
                            ${homeIconHtml}
                        </div>`;

                    return { html: innerHtml };
                },

                // --- [UX 개선] 상세 정보 뷰 리팩토링 ---
                eventClick: function (info) {
                    const eventData = info.event.extendedProps;
                    const homeTeamName = kboTeams[eventData.home_team]?.name || eventData.home_team;
                    const awayTeamName = kboTeams[eventData.away_team]?.name || eventData.away_team;
                    const hasScore = typeof eventData.home_score === 'number' && typeof eventData.away_score === 'number';

                    eventDetailsEl.innerHTML = `
                        <div class="space-y-2 text-sm">
                            <p><strong class="w-20 inline-block font-semibold">경기 ID:</strong> <span class="text-gray-600">${info.event.id}</span></p>
                            <p><strong class="w-20 inline-block font-semibold">시작 시간:</strong> <span class="text-gray-600">${new Date(eventData.start).toLocaleString('ko-KR')}</span></p>
                        </div>
                        <div class="mt-4 pt-3 border-t border-gray-200">
                            <div class="grid grid-cols-3 items-center text-center gap-2">
                                <!-- 홈팀 정보 -->
                                <div class="flex flex-col items-center justify-center">
                                    <img src="${eventData.home_mascot_url}" alt="${homeTeamName}" class="w-16 h-16 object-contain">
                                    <span class="font-bold text-lg mt-1">${homeTeamName}</span>
                                    <span class="text-xs text-gray-500">HOME</span>
                                </div>
                                <!-- 점수 정보 -->
                                <div class="flex items-center justify-center space-x-2">
                                    ${hasScore ? `
                                        <span class="text-4xl font-bold">${eventData.home_score}</span>
                                        <span class="text-2xl text-gray-400">:</span>
                                        <span class="text-4xl font-bold">${eventData.away_score}</span>
                                    ` : '<span class="text-lg text-gray-400">경기 전</span>'}
                                </div>
                                <!-- 원정팀 정보 -->
                                <div class="flex flex-col items-center justify-center">
                                    <img src="${eventData.away_mascot_url}" alt="${awayTeamName}" class="w-16 h-16 object-contain">
                                    <span class="font-bold text-lg mt-1">${awayTeamName}</span>
                                    <span class="text-xs text-gray-500">AWAY</span>
                                </div>
                            </div>
                        </div>
                    `;
                    eventDetailsContainerEl.classList.remove('hidden');
                }
            });

            calendar.render();

            teamSelectEl.addEventListener('change', function () {
                currentSelectedTeam = this.value; // 전역 변수 업데이트
                calendar.refetchEvents(); // 캘린더 이벤트 재로딩 및 렌더링
                eventDetailsContainerEl.classList.add('hidden'); // 상세 정보 창 숨기기
            });
        })
        .catch(error => {
            console.error('Error fetching schedule data:', error);
            calendarEl.innerHTML = '<p class="text-red-500 text-center py-4">경기 일정을 불러오는 데 실패했습니다.</p>';
        });
});

document.addEventListener('DOMContentLoaded', function () {

    // --- [1. 데이터 설계] ---
    const DEFAULT_MASCOT_URL = 'https://placehold.co/32x32?text=NA';
    const kboTeams = {
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
                height: 'auto', // 높이 자동 조절 (스크롤바 방지)
                // showNonCurrentDates: true, // (기본값) 이전/다음 달 날짜 표시
                fixedWeekCount: false, // 이번 달의 주 수에 맞춰 높이 조절 (빈 주 숨김)
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listWeek'
                },
                locale: 'ko',
                buttonText: {
                    today: '오늘',
                    month: '월',
                    list: '주' // listWeek view maps to 'list'
                },
                firstDay: 1, // 월요일부터 시작
                // events 콜백을 사용하여 필터링된 이벤트를 제공
                events: function (fetchInfo, successCallback, failureCallback) {
                    successCallback(getFilteredEvents(currentSelectedTeam));
                },
                eventDisplay: 'block',

                // --- [UX 개선] 날짜 셀 커스텀 (홈경기 표시) ---
                dayCellContent: function (arg) {
                    const date = arg.date;
                    const dayNumber = arg.dayNumberText.replace('일', ''); // '1일' -> '1'

                    // 현재 루프 중인 날짜가 해당 월이 아니면(이전/다음달 날짜) 투명도 처리된 상태로 날짜만 표시 (CSS로 제어하기 위해 제거)
                    // if (arg.isOther) return; 

                    // 해당 날짜에 선택된 팀의 '홈 경기'가 있는지 확인 (이전/다음달 날짜도 포함)
                    // 날짜 비교를 위해 YYYY-MM-DD 문자열 생성
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateString = `${year}-${month}-${day}`;

                    // allScheduleData는 fetch scope 안에 있으므로 여기서 접근 가능 (closure)
                    const isHomeGame = allScheduleData.some(game => {
                        const gameDate = game.start.split('T')[0];
                        return gameDate === dateString && game.home_team === currentSelectedTeam;
                    });

                    let html = '';
                    if (isHomeGame) {
                        // 홈 경기일 때: 빨간 원 표시 (연하게 변경) + 반응형 크기 조절
                        html = `
                            <div class="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-red-300 rounded-full shadow-sm">
                                <span class="text-gray-900 font-bold text-xs sm:text-sm leading-none pt-0.5">${dayNumber}</span>
                            </div>`;
                    } else {
                        // 원정 경기 또는 경기 없음: 일반 표시
                        html = `<span class="text-gray-700 font-medium text-xs sm:text-sm p-1 inline-block">${dayNumber}</span>`;
                    }

                    return { html: html };
                },
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

                    // 1. 승/패/무 뱃지: 점수가 있고, 선택된 팀의 경기인 경우에만 표시
                    const hasScore = typeof event.home_score === 'number' && typeof event.away_score === 'number';
                    if (hasScore) {
                        let result = '';
                        // '승', '패', '무' 로직 (선택된 팀 기준)
                        if (isHomeTeamSelected) {
                            if (event.home_score > event.away_score) result = '승';
                            else if (event.home_score < event.away_score) result = '패';
                            else result = '무';
                        } else if (isAwayTeamSelected) {
                            if (event.away_score > event.home_score) result = '승';
                            else if (event.away_score < event.home_score) result = '패';
                            else result = '무';
                        }

                        if (result) {
                            // 팀 데이터에서 slug 가져오기
                            // event.home_team, event.away_team은 팀 키('LG', 'KT' 등)
                            let opponentTeamKey = '';
                            if (isHomeTeamSelected) opponentTeamKey = event.away_team;
                            else if (isAwayTeamSelected) opponentTeamKey = event.home_team;

                            const teamSlug = kboTeams[opponentTeamKey]?.slug;

                            if (result === '승') {
                                // 내 팀 승리 -> 상대팀 패배 -> 상대팀의 _lose 이미지 사용
                                if (teamSlug) mascotUrl = `assets/images/${teamSlug}_lose.png`;
                            } else if (result === '패') {
                                // 내 팀 패배 -> 상대팀 승리 -> 상대팀의 _win 이미지 사용
                                if (teamSlug) mascotUrl = `assets/images/${teamSlug}_win.png`;
                            } else {
                                // 무승부: 땀흘리는 이미지 사용
                                if (teamSlug) mascotUrl = `assets/images/${teamSlug}_tie.png`;
                            }
                        }
                    }

                    // 2. 홈 뱃지: 삭제됨 (날짜 표시로 대체)

                    // 3. 최종 HTML 조합
                    // flex를 사용하여 마스코트를 정중앙에 배치
                    // 반응형: 모바일 w-10 h-10, 데스크탑 w-14 h-14 (기존 w-16에서 축소)
                    // 패딩: 모바일 pb-1, 데스크탑 pb-3 (기존보다 넉넉하게)
                    const innerHtml = `
                        <div class="relative flex justify-center items-center w-full h-full min-h-[50px] sm:min-h-[60px] pb-1 sm:pb-3">
                            <img src="${mascotUrl}" alt="${altText}" class="w-10 h-10 sm:w-14 sm:h-14 object-contain filter drop-shadow-sm transition-transform duration-200 hover:scale-110" onerror="this.src='${DEFAULT_MASCOT_URL}'">
                            ${resultBadgeHtml}
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
                            <p><strong class="w-20 inline-block font-semibold">시작 시간:</strong> <span class="text-gray-600">${info.event.start.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</span></p>
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

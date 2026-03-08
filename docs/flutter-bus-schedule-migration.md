# Flutter Bus Schedule Migration Guide

Bus config가 keyed object → ordered `groups` 배열로 변경됨.
Campus 스케줄이 per-daytype endpoint → 주간 단위 resolution engine으로 변경됨.

---

## 1. API 변경 요약

| Before | After |
|--------|-------|
| `GET /bus/config` → `{ hssc: {...}, campus: {...} }` | `GET /bus/config` → `{ groups: [...] }` |
| `GET /bus/config/version` → `{ configVersion: N }` | 삭제 — ETag/304로 대체 |
| `GET /bus/campus/inja/{dayType}` | `GET /bus/schedule/data/{serviceId}/week?from=YYYY-MM-DD` |
| `GET /bus/campus/jain/{dayType}` | 위와 동일 (serviceId: campus-jain) |
| `GET /bus/campus/eta` | 변경 없음 |

---

## 2. `/bus/config` 새 응답 구조

```json
{
  "meta": { "lang": "ko" },
  "data": {
    "groups": [
      {
        "id": "hssc",
        "screenType": "realtime",
        "label": "인사캠 셔틀버스",
        "visibility": { "type": "always" },
        "card": {
          "themeColor": "003626",
          "iconType": "shuttle",
          "busTypeText": "성대"
        },
        "screen": {
          "endpoint": "/bus/realtime/ui/hssc"
        }
      },
      {
        "id": "campus",
        "screenType": "schedule",
        "label": "인자셔틀",
        "visibility": { "type": "always" },
        "card": { "themeColor": "003626", "iconType": "shuttle", "busTypeText": "성대" },
        "screen": {
          "defaultServiceId": "campus-inja",
          "services": [
            { "serviceId": "campus-inja", "label": "인사캠 → 자과캠", "weekEndpoint": "/bus/schedule/data/campus-inja/week" },
            { "serviceId": "campus-jain", "label": "자과캠 → 인사캠", "weekEndpoint": "/bus/schedule/data/campus-jain/week" }
          ],
          "heroCard": {
            "etaEndpoint": "/bus/campus/eta",
            "showUntilMinutesBefore": 0
          },
          "routeBadges": [
            { "id": "regular", "label": "일반", "color": "003626" },
            { "id": "hakbu", "label": "학부대학", "color": "1565C0" }
          ],
          "features": [
            { "type": "info", "url": "https://..." }
          ]
        }
      },
      {
        "id": "fasttrack",
        "screenType": "schedule",
        "label": "패스트트랙",
        "visibility": { "type": "dateRange", "from": "2026-03-09", "until": "2026-03-10" },
        "card": { "themeColor": "E65100", "iconType": "shuttle", "busTypeText": "패스트트랙" },
        "screen": {
          "defaultServiceId": "fasttrack-inja",
          "services": [
            { "serviceId": "fasttrack-inja", "label": "인사캠 → 자과캠", "weekEndpoint": "/bus/schedule/data/fasttrack-inja/week" }
          ],
          "heroCard": null,
          "routeBadges": [
            { "id": "fasttrack", "label": "패스트트랙", "color": "E65100" }
          ],
          "features": []
        }
      },
      { "id": "jongro02", "screenType": "realtime", "..." : "..." },
      { "id": "jongro07", "screenType": "realtime", "..." : "..." }
    ]
  }
}
```

### 핵심 변경 사항

- **groups는 배열** → 순서가 곧 UI 표시 순서
- **screenType**: `"realtime"` | `"schedule"` — 화면 분기 기준
- **visibility**: 클라이언트가 group을 보여줄지 결정
  - `{ type: "always" }` → 항상 표시
  - `{ type: "dateRange", from, until }` → KST 기준 `from 00:00` ~ `until 23:59:59.999` 사이에만 표시
- **card**: 메인 목록 카드 렌더링용 (themeColor, iconType, busTypeText)
- **screen**: 상세 화면 렌더링용
  - realtime: `screen.endpoint` (기존 realtime 화면 재사용)
  - schedule: `screen.services[]`, `screen.routeBadges[]`, `screen.heroCard`, `screen.features[]`

### ETag 캐싱

```
GET /bus/config
→ 200, ETag: "abc123..."

GET /bus/config
If-None-Match: "abc123..."
→ 304 Not Modified (body 없음)
```

기존 `checkForUpdates()` → `/bus/config/version` 방식 삭제.
`safeGetConditional`로 ETag 기반 캐싱 사용.

---

## 3. `/bus/schedule/data/:serviceId/week` 응답 구조

```
GET /bus/schedule/data/campus-inja/week?from=2026-03-09
```

```json
{
  "meta": { "lang": "ko" },
  "data": {
    "serviceId": "campus-inja",
    "requestedFrom": "2026-03-09",
    "from": "2026-03-09",
    "days": [
      {
        "date": "2026-03-09",
        "dayOfWeek": 1,
        "display": "schedule",
        "label": null,
        "notices": [
          { "style": "info", "text": "25년도 2학기 인자셔틀 시간표 업데이트", "source": "service" }
        ],
        "schedule": [
          { "index": 1, "time": "07:00", "routeType": "regular", "busCount": 1, "notes": null },
          { "index": 2, "time": "10:00", "routeType": "regular", "busCount": 1, "notes": null }
        ]
      },
      {
        "date": "2026-03-14",
        "dayOfWeek": 6,
        "display": "noService",
        "label": null,
        "notices": [],
        "schedule": []
      }
    ]
  }
}
```

### 필드 설명

| 필드 | 설명 |
|------|------|
| `from` | Monday로 정규화된 주간 시작일 |
| `requestedFrom` | 클라이언트가 보낸 원본 값 (없으면 `null`) |
| `days[].display` | `"schedule"` = 시간표 있음, `"noService"` = 운행 없음, `"hidden"` = UI에서 숨김 |
| `days[].label` | override 있을 때만 값 있음 (예: "ESKARA 1일차", "삼일절") |
| `days[].notices[]` | `{ style, text, source }` — source가 `"service"` 또는 `"override"` |
| `days[].schedule[]` | `{ index, time, routeType, busCount, notes }` |

### `from` 파라미터 동작

- **생략** → 현재 주의 월요일 (서버 KST 기준)
- **월요일이 아닌 날짜** → 해당 주의 월요일로 정규화
- **잘못된 형식** → `400 { meta: { error: "INVALID_DATE_FORMAT" }, data: null }`

### ETag 캐싱

```
ETag: "week-campus-inja-2026-03-09-{md5}"
Cache-Control: public, max-age=300
```

`safeGetConditional`으로 캐싱. 5분 TTL.

### 에러 응답 (schedule 전용 형식)

```json
{ "meta": { "error": "SERVICE_NOT_FOUND", "message": "..." }, "data": null }
{ "meta": { "error": "INVALID_DATE_FORMAT", "message": "..." }, "data": null }
```

주의: 전역 에러 형식 `{ error: { code, message } }`와 **다름**.
`meta.error` 존재 여부로 분기 필요.

---

## 4. Flutter 모델 변경

### 삭제할 모델/클래스

- `BusRouteConfig` — 통째로 교체
- `BusDisplay`, `RealtimeConfig`, `ScheduleConfig`, `BusDirection`
- `ServiceCalendar`, `ServiceException`
- `BusFeatures`, `InfoFeature`, `RouteOverlayFeature`, `EtaFeature`

### 새 모델: `BusGroup`

```dart
// lib/app/model/bus_group.dart

class BusGroup {
  final String id;
  final String screenType; // "realtime" | "schedule"
  final String label;
  final BusGroupVisibility visibility;
  final BusGroupCard card;
  final Map<String, dynamic> screen; // screen 구조가 screenType에 따라 다름

  BusGroup({...});

  factory BusGroup.fromJson(Map<String, dynamic> json) {
    return BusGroup(
      id: json['id'],
      screenType: json['screenType'],
      label: json['label'],
      visibility: BusGroupVisibility.fromJson(json['visibility']),
      card: BusGroupCard.fromJson(json['card']),
      screen: json['screen'],
    );
  }

  bool get isRealtime => screenType == 'realtime';
  bool get isSchedule => screenType == 'schedule';

  /// 현재 시각 기준으로 이 group을 보여야 하는지
  bool isVisible(DateTime now) => visibility.isVisible(now);

  // --- schedule 전용 접근자 ---
  String? get defaultServiceId => screen['defaultServiceId'];
  List<BusService> get services =>
      (screen['services'] as List? ?? [])
          .map((e) => BusService.fromJson(e))
          .toList();
  HeroCard? get heroCard => screen['heroCard'] != null
      ? HeroCard.fromJson(screen['heroCard'])
      : null;
  List<RouteBadge> get routeBadges =>
      (screen['routeBadges'] as List? ?? [])
          .map((e) => RouteBadge.fromJson(e))
          .toList();

  // --- realtime 전용 접근자 ---
  String? get realtimeEndpoint => screen['endpoint'];
}
```

### 새 모델: `BusGroupVisibility`

```dart
class BusGroupVisibility {
  final String type; // "always" | "dateRange"
  final String? from;
  final String? until;

  BusGroupVisibility({required this.type, this.from, this.until});

  factory BusGroupVisibility.fromJson(Map<String, dynamic> json) {
    return BusGroupVisibility(
      type: json['type'],
      from: json['from'],
      until: json['until'],
    );
  }

  bool isVisible(DateTime now) {
    if (type == 'always') return true;
    if (type == 'dateRange' && from != null && until != null) {
      final start = DateTime.parse(from!);
      final end = DateTime.parse('${until!}T23:59:59.999');
      return !now.isBefore(start) && !now.isAfter(end);
    }
    return true;
  }
}
```

### 새 모델: `BusService`, `RouteBadge`, `HeroCard`

```dart
class BusService {
  final String serviceId;
  final String label;
  final String weekEndpoint;

  BusService({...});
  factory BusService.fromJson(Map<String, dynamic> json) => BusService(
    serviceId: json['serviceId'],
    label: json['label'],
    weekEndpoint: json['weekEndpoint'],
  );
}

class RouteBadge {
  final String id;
  final String label;
  final String color; // hex "003626"

  RouteBadge({...});
  factory RouteBadge.fromJson(Map<String, dynamic> json) => RouteBadge(
    id: json['id'],
    label: json['label'],
    color: json['color'],
  );
}

class HeroCard {
  final String etaEndpoint;
  final int showUntilMinutesBefore;

  HeroCard({...});
  factory HeroCard.fromJson(Map<String, dynamic> json) => HeroCard(
    etaEndpoint: json['etaEndpoint'],
    showUntilMinutesBefore: json['showUntilMinutesBefore'],
  );
}
```

### 새 모델: `WeekSchedule`, `DaySchedule`, `ScheduleEntry`, `ScheduleNotice`

```dart
// lib/app/model/week_schedule.dart

class WeekSchedule {
  final String serviceId;
  final String? requestedFrom;
  final String from;
  final List<DaySchedule> days;

  WeekSchedule({...});

  factory WeekSchedule.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>;
    return WeekSchedule(
      serviceId: data['serviceId'],
      requestedFrom: data['requestedFrom'],
      from: data['from'],
      days: (data['days'] as List)
          .map((d) => DaySchedule.fromJson(d))
          .toList(),
    );
  }

  /// 오늘 날짜에 해당하는 DaySchedule 반환
  DaySchedule? today(DateTime now) {
    final dateStr = _formatDate(now);
    return days.where((d) => d.date == dateStr).firstOrNull;
  }

  static String _formatDate(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

class DaySchedule {
  final String date;      // "2026-03-09"
  final int dayOfWeek;    // 1(Mon)~7(Sun)
  final String display;   // "schedule" | "noService" | "hidden"
  final String? label;    // "ESKARA 1일차", "삼일절", null
  final List<ScheduleNotice> notices;
  final List<ScheduleEntry> schedule;

  DaySchedule({...});

  bool get hasSchedule => display == 'schedule';
  bool get isNoService => display == 'noService';
  bool get isHidden => display == 'hidden';

  factory DaySchedule.fromJson(Map<String, dynamic> json) {
    return DaySchedule(
      date: json['date'],
      dayOfWeek: json['dayOfWeek'],
      display: json['display'],
      label: json['label'],
      notices: (json['notices'] as List)
          .map((n) => ScheduleNotice.fromJson(n))
          .toList(),
      schedule: (json['schedule'] as List)
          .map((e) => ScheduleEntry.fromJson(e))
          .toList(),
    );
  }
}

class ScheduleEntry {
  final int index;
  final String time;       // "07:00"
  final String routeType;  // "regular" | "hakbu" | "fasttrack"
  final int busCount;
  final String? notes;     // "만석 시 조기출발", null

  ScheduleEntry({...});
  factory ScheduleEntry.fromJson(Map<String, dynamic> json) => ScheduleEntry(
    index: json['index'],
    time: json['time'],
    routeType: json['routeType'],
    busCount: json['busCount'],
    notes: json['notes'],
  );
}

class ScheduleNotice {
  final String style;   // "info" | "warning"
  final String text;
  final String source;  // "service" | "override"

  ScheduleNotice({...});
  factory ScheduleNotice.fromJson(Map<String, dynamic> json) => ScheduleNotice(
    style: json['style'],
    text: json['text'],
    source: json['source'],
  );
}
```

---

## 5. Repository 변경

### `BusConfigRepository` — 전면 교체

```dart
class BusConfigRepository {
  final ApiClient _client;
  List<BusGroup>? _groups;
  String? _etag;
  String? _cachedLang;

  bool get isLoaded => _groups != null;
  List<BusGroup> get groups => _groups ?? [];

  /// 현재 시각 기준 visible groups만 반환
  List<BusGroup> visibleGroups(DateTime now) =>
      groups.where((g) => g.isVisible(now)).toList();

  BusConfigRepository(this._client);

  String get _currentLang { /* 기존과 동일 */ }

  /// ETag 기반 fetch. 304면 캐시 유지.
  Future<void> initialize() async {
    // 언어 변경 시 캐시 무효화
    if (_cachedLang != _currentLang) {
      _etag = null;
    }

    final result = await _client.safeGetConditional<List<BusGroup>>(
      '/bus/config',
      (json) {
        final envelope = json as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;
        final groupsList = data['groups'] as List;
        return groupsList
            .map((g) => BusGroup.fromJson(g as Map<String, dynamic>))
            .toList();
      },
      ifNoneMatch: _etag,
    );

    switch (result) {
      case Ok(:final data):
        if (!data.notModified) {
          _groups = data.data;
          _etag = data.etag;
          _cachedLang = _currentLang;
          logger.d('BusConfig loaded: ${_groups!.length} groups');
        } else {
          logger.d('BusConfig not modified (304)');
        }
      case Err(:final failure):
        logger.e('BusConfig init failed: $failure');
    }
  }

  /// checkForUpdates() → 이제 initialize()와 동일 (ETag가 304 처리)
  Future<void> checkForUpdates() => initialize();

  BusGroup? getById(String id) =>
      _groups?.where((g) => g.id == id).firstOrNull;
}
```

### `BusRepository` — week endpoint 추가

```dart
class BusRepository {
  final ApiClient _client;

  /// 주간 스케줄 조회 (ETag 캐싱)
  Future<Result<ConditionalResult<WeekSchedule>>> getWeekSchedule(
    String weekEndpoint, {
    String? from,
    String? ifNoneMatch,
  }) async {
    return _client.safeGetConditional<WeekSchedule>(
      weekEndpoint,
      (json) => WeekSchedule.fromJson(json),
      queryParameters: from != null ? {'from': from} : null,
      ifNoneMatch: ifNoneMatch,
    );
  }

  // 기존 메서드 유지:
  // getLocationsByPath, getStationsByPath, getCampusEta, getRouteOverlay
}
```

### `ApiEndpoints` — 변경

```dart
class ApiEndpoints {
  // 삭제:
  // - busConfigVersion()

  // 변경 없음:
  // - busConfig()         → '/bus/config'
  // - campusEta()         → '/bus/campus/eta'

  // 신규 (참고용 — 실제 endpoint는 config의 weekEndpoint 사용):
  // static String scheduleWeek(String serviceId) => '/bus/schedule/data/$serviceId/week';
}
```

> weekEndpoint는 `/bus/config` 응답의 `screen.services[].weekEndpoint`에서 내려오므로,
> 하드코딩하지 않고 서버가 준 값을 그대로 사용.

---

## 6. Controller 변경

### 메인페이지: group 목록 → bus list 렌더링

```dart
// 기존: BusConfigRepository.all → Map<String, BusRouteConfig>
// 변경: BusConfigRepository.visibleGroups(DateTime.now()) → List<BusGroup>

final groups = busConfigRepo.visibleGroups(DateTime.now());
// groups 순서대로 카드 렌더링
for (final group in groups) {
  // card.themeColor, card.iconType, card.busTypeText, group.label
  // 탭 시 screenType에 따라 분기:
  //   "realtime" → BusRealtimePage(group)
  //   "schedule" → BusSchedulePage(group)
}
```

### `BusScheduleController` — 신규 (기존 `BusCampusController` 대체)

```dart
class BusScheduleController extends GetxController {
  final BusRepository _busRepo;
  final BusGroup group;

  // 현재 선택된 service (탭)
  late Rx<BusService> currentService;

  // 주간 스케줄 데이터
  var weekSchedule = Rx<WeekSchedule?>(null);
  var selectedDayIndex = 0.obs; // 0=Mon, 6=Sun
  var isLoading = false.obs;

  // ETag 캐시 (serviceId별)
  final _etagMap = <String, String>{};

  @override
  void onInit() {
    super.onInit();
    currentService = Rx(group.services.firstWhere(
      (s) => s.serviceId == group.defaultServiceId,
      orElse: () => group.services.first,
    ));
    _fetchCurrentWeek();
  }

  /// 서비스 탭 전환
  void switchService(BusService service) {
    currentService.value = service;
    weekSchedule.value = null;
    _fetchCurrentWeek();
  }

  /// 주간 데이터 fetch
  Future<void> _fetchCurrentWeek({String? from}) async {
    isLoading.value = true;
    final svc = currentService.value;
    final etag = _etagMap[svc.serviceId];

    final result = await _busRepo.getWeekSchedule(
      svc.weekEndpoint,
      from: from,
      ifNoneMatch: etag,
    );

    switch (result) {
      case Ok(:final data):
        if (!data.notModified && data.data != null) {
          weekSchedule.value = data.data;
          _etagMap[svc.serviceId] = data.etag ?? '';
        }
      case Err(:final failure):
        logger.e('Schedule fetch failed: $failure');
    }
    isLoading.value = false;
  }

  // --- Computed getters ---

  DaySchedule? get selectedDay =>
      weekSchedule.value?.days[selectedDayIndex.value];

  List<ScheduleEntry> get currentEntries =>
      selectedDay?.schedule ?? [];

  bool get isNoService =>
      selectedDay?.isNoService ?? false;

  String? get dayLabel => selectedDay?.label;

  List<ScheduleNotice> get dayNotices =>
      selectedDay?.notices ?? [];
}
```

---

## 7. UI 렌더링 가이드

### 요일 선택 바 (Week Day Selector)

```
월  화  수  목  금  토  일
─────────────────────────
 ●                        ← selectedDayIndex
```

- `weekSchedule.days`의 7개 항목 사용
- `display == "hidden"` 인 날은 회색 처리 또는 숨김
- `label != null`이면 날짜 아래에 라벨 표시 (예: "ESKARA 1일차")

### display별 렌더링

```dart
switch (selectedDay.display) {
  case 'schedule':
    // notices 표시 (style에 따라 info/warning 스타일 분기)
    // schedule 목록 렌더링
    break;
  case 'noService':
    // "운행 없음" 표시 + label 있으면 사유 표시 (삼일절 등)
    break;
  case 'hidden':
    // 해당 날 선택 불가 또는 빈 상태
    break;
}
```

### 스케줄 엔트리 렌더링

```dart
for (final entry in currentEntries) {
  Row(
    children: [
      Text(entry.time),                        // "07:00"
      RouteBadgeChip(entry.routeType, group),  // routeBadges에서 색상/라벨 조회
      if (entry.busCount > 1) Text('${entry.busCount}대'),
      if (entry.notes != null) Text(entry.notes!),
    ],
  );
}
```

`routeType`과 `routeBadges` 매칭:
```dart
RouteBadge? badge = group.routeBadges
    .where((b) => b.id == entry.routeType)
    .firstOrNull;
// badge?.label → "일반", badge?.color → "003626"
```

### Notice 렌더링

```dart
for (final notice in dayNotices) {
  Container(
    color: notice.style == 'warning' ? Colors.orange[50] : Colors.blue[50],
    child: Text(notice.text),
  );
}
```

### HeroCard (campus ETA)

```dart
if (group.heroCard != null) {
  // getCampusEta() 호출
  // showUntilMinutesBefore: 다음 버스 출발 N분 전까지만 표시 (0이면 항상)
}
```

---

## 8. 주간 네비게이션

```dart
// 이전 주 / 다음 주
void goToPreviousWeek() {
  final current = DateTime.parse(weekSchedule.value!.from);
  final prev = current.subtract(Duration(days: 7));
  _fetchCurrentWeek(from: _formatDate(prev));
}

void goToNextWeek() {
  final current = DateTime.parse(weekSchedule.value!.from);
  final next = current.add(Duration(days: 7));
  _fetchCurrentWeek(from: _formatDate(next));
}
```

---

## 9. 에러 처리 주의사항

schedule 엔드포인트의 에러 형식이 전역과 다름:

```json
{ "meta": { "error": "SERVICE_NOT_FOUND", "message": "..." }, "data": null }
```

`ApiClient._parseServerError()`에서 `error.code` 대신 `meta.error`를 확인해야 함.
또는 `safeGet` parser에서 `data == null && meta.error != null` 일 때 별도 처리:

```dart
final result = await _client.safeGet(endpoint, (json) {
  final envelope = json as Map<String, dynamic>;
  final meta = envelope['meta'] as Map<String, dynamic>;
  if (meta.containsKey('error')) {
    throw ScheduleApiError(meta['error'], meta['message']);
  }
  return WeekSchedule.fromJson(envelope);
});
```

---

## 10. 마이그레이션 체크리스트

### 모델
- [ ] `bus_route_config.dart` → 삭제
- [ ] `bus_group.dart` 신규 생성 (BusGroup, BusGroupVisibility, BusGroupCard, BusService, RouteBadge, HeroCard)
- [ ] `week_schedule.dart` 신규 생성 (WeekSchedule, DaySchedule, ScheduleEntry, ScheduleNotice)

### Repository
- [ ] `bus_config_repository.dart` 전면 교체 (keyed map → groups list, version check → ETag)
- [ ] `bus_repository.dart`에 `getWeekSchedule()` 추가
- [ ] `api_endpoints.dart`에서 `busConfigVersion()` 삭제

### Controller
- [ ] `bus_campus_controller.dart` → `bus_schedule_controller.dart`로 교체
- [ ] 메인페이지: `BusConfigRepository.all` → `visibleGroups(DateTime.now())`

### UI
- [ ] 메인 bus list: groups 배열 순서대로 렌더링 + visibility 필터링
- [ ] schedule 화면: 7일 요일 선택 바 + display별 분기 + routeBadge 색상 매칭
- [ ] notice 렌더링 (style별 색상 분기)
- [ ] 주간 네비게이션 (이전 주 / 다음 주)
- [ ] ETag 캐싱 적용 (config + week schedule 모두)

### 삭제
- [ ] `/bus/config/version` 호출 코드
- [ ] `ServiceCalendar`, `ServiceException` 관련 로직 (서버가 display 필드로 대체)
- [ ] `BusDirection.endpoint` + `{dayType}` 치환 로직 (weekEndpoint로 대체)

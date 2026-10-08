# Myeong 命

> 전통 명리학의 **고정된 규칙집**으로 사주팔자를 계산하고, 근거를 함께 보여주는 도구.
> 웹 화면과 하루 한 장 이메일 — 둘이 **같은 계산 엔진**을 씁니다.

같은 출생 정보와 같은 날짜를 넣으면, 웹에서 보든 이메일을 받든 **같은 결과**가 나옵니다.
무작위로 문장을 고르는 일도, 확률을 매기는 일도, 100점 만점은 **없습니다.**

---

| --- | --- |
| 오늘의 운세 | 총운·재물·직업·애정·대인관계·학업·건강·이동 8항목. 해석과 분석 근거를 나눠 제시 |
| 내 사주 | 네 기둥의 천간·지지·음양·오행·십신·지장간·십이지운성. **변하지 않는 정보**로 따로 묶어 둠 |
| 대운 | 10년 대운 타임라인. 지금 걸린 대운을 강조하고 눌러서 상세로 |
| 연운 / 월운 / 일운 | 해당 운의 기둥과 오늘과의 작용 |
| 운세 캘린더 | 월 단위 달력. 같은 Core 로 계산 |
| 기간 비교 | 두 기간의 오행·십신·대운·세운·합충을 **나란히**. 좋고 나쁨을 정하지 않는다 |
| 용어집 | 70개 용어. 설명과 해석을 **분리**해 두었다 |
| 규칙 카탈로그 | 49개 규칙. ID·정의·기준·해석 |
| 설정 | 출생 정보 수정·삭제 |

---

## 설치와 실행

요구 사항: **Node.js 20 이상.**

```bash
npm install
npm run dev        # 개발 서버
npm run build      # 타입 검사 + 정적 빌드 → dist/
npm run preview    # 빌드 결과 미리 보기
npm test           # 테스트 561개
npm run typecheck  # 타입만 검사
```

---

## 웹으로 쓰기

```bash
npm run dev
```

브라우저에서 표시된 주소를 연다.

1. **내 사주** 화면에서 출생 정보를 넣는다.
   - 양력 / 음력 → 윤달 여부
   - 12시진 또는 **"출생시간 모름"**
   - 자시를 고른 경우에만 **조자시 / 자정** 을 고른다
   - 출생지: **시/도 → 시/군/구** 2단계 선택 (자유 입력 없음)
2. 음력으로 넣으면 **변환된 양력이 해석보다 먼저** 나온다. (잘못 넣은 걸 숨기지 않기 위해)
3. 저장하면 채워 넣어 두었기 때문에 다음에 바로 계산한다.

입력한 정보는 **이 브라우저에만** 남는다. 서버로 나가지 않는다.
언제든 **설정 → 삭제** 로 지울 수 있다.

### 편의 기능

- 키보드만으로 전부 이동할 수 있다. (첫 항목은 "본문 바로 가기")
- 용어와 규칙 ID 를 눌러 정의를 바로 본다.
- **오늘의 운세 → 근거 → 일진 → 월운 → 세운 → 대운 → 원국** 으로 내려간다.
- 화면이 좁아도 쓸 수 있다. (모바일 안전)
- 내 사주(고정)와 운세(변함)는 화면에서도 시각적으로 분리된다.

---

## 배포 — GitHub Pages

```bash
npm run build          # dist/ 생성
git add dist           # 또는 gh-pages 브랜치로
```

`vite.config.ts` 에 `base: "./"` 가 들어 있어 **하위 경로 배포에도 그대로 동작**한다.

### 설정 순서

1. 저장소 **Settings → Pages** → Source 를 **GitHub Actions** 로 선택
2. 아래 워크플로를 추가하면 자동으로 빌드·배포된다

```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - uses: actions/deploy-pages@v4
```

> 이 워크플로는 **웹 산출물만** 올린다. 개인 계산 결과는 어떤 것도 포함되지 않는다.
> (`dist/` 에 그런 파일을 만들지 않는다)

---

## 하루치 운세 이메일

`.github/workflows/daily-fortune.yml` 이 **매일** 돌아가 이메일을 보낸다.

- 실행 시각: `0 20 * * *` UTC = **한국 시간 다음 날 05:00**
- "오늘"은 GitHub Actions 가 실행되는 시각이 아니라 **`todayInKorea()` 가 구한 한국 날짜**다.
- 같은 시각에 두 번 돌아도 메일이 두 번 가지 않도록 `concurrency` 로 막는다.

### Secrets 설정

저장소 **Settings → Secrets and variables → Actions → New repository secret**

> ## ⚠️ 저장소에는 넣지 마세요
> 아래 값들은 **절대로** 코드 · 파일 · 커밋 · 이슈 · PR 에 쓰지 않는다.
> GitHub 의 비밀값 마스킹에 기대지 않는다. (변환된 값은 그대로 로그에 남는다)
> 이 프로그램은 애초에 로그에 값을 쓰지 않지만, 입력하는 쪽에서도 조심해야 한다.

**필수**

| 이름 | 예 | 설명 |
| --- | --- | --- |
| `BIRTH_DATE` | `1990-05-20` | 출생 날짜 `YYYY-MM-DD` |
| `BIRTH_CALENDAR` | `solar` 또는 `lunar` | 양력 / 음력 |
| `BIRTH_PLACE` | `서울특별시/서대문구` | `시도/시군구` — 아래 형식 참고 |
| `EMAIL_USERNAME` | *(메일 계정)* | 발신 계정. 로그인 아이디 |
| `EMAIL_PASSWORD` | *(앱 비밀번호)* | **SMTP 앱 비밀번호** 를 권장 |
| `SMTP_HOST` | `smtp.example.com` | SMTP 서버 |

**선택**

| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `BIRTH_LEAP_MONTH` | — | 음력이면 **필수**(`true`/`false`). 양력이면 무시되고 `false` 로 고정 |
| `BIRTH_TIME` | *(없음)* | 시진 번호 `0`–`11` (0=자시). **비우면 "출생시간 모름"** |
| `BIRTH_ZI_MODE` | `자정` | `자정` 또는 `조자시`. 자시를 고른 경우에만 의미가 있다 |
| `BIRTH_GENDER` | *(없음)* | `남` 또는 `여`. 없으면 간지순역법으로 계산 |
| `SMTP_PORT` | `465` | 기본값은 **암호화 연결(implicit TLS)** |
| `EMAIL_TO` | `EMAIL_USERNAME` | 다를 때만 지정 |

`BIRTH_PLACE` 는 **구조화된 값**이다. 등록된 시도·시군구 이름이어야 한다.

```
시도/시군구
예) 서울특별시/종로구
예) 세종특별자치시        ← 시군구가 없는 시. 뒤에 붙이지 않는다
```

가능한 시도는 `SIDO_LIST`, 시군구는 `sigunguListOf(시도)` 로 확인할 수 있다.

### 로컬에서 시험하기

```bash
# PowerShell
$env:BIRTH_DATE='1990-05-20'; $env:BIRTH_CALENDAR='solar'; $env:BIRTH_PLACE='서울특별시/종로구'
$env:EMAIL_USERNAME='...'; $env:EMAIL_PASSWORD='...'; $env:SMTP_HOST='...'
npm run email
```

가짜 값으로 시험할 때 (평문 로컬 서버 한정, **운영에서 쓰지 않는다**):

```
MYEONG_SMTP_INSECURE=true      평문 연결
MYEONG_SMTP_AUTH=PLAIN         AUTH PLAIN (기본은 AUTH LOGIN)
```

### 메일이 보내는 것

웹의 **오늘의 운세** 화면과 같은 항목, 같은 문장, 같은 근거를 **평문**으로 담습니다.
날짜·기둥·해석·근거(규칙 ID 포함)·주의점·드릴다운·고지.

**HTML 을 쓰지 않는다.** 메일 클라이언트마다 다르게 보이므로 평문이 정직합니다.

### 어떤 로그가 남나

네 줄뿐입니다. (`email/main.ts` 의 `ALLOWED_LOGS`, 테스트로 고정)

```
Myeong Core started
Calculation completed
Email sent successfully
Email sending failed: <사유>
```

기둥 · 간지 · 운세 · 메일 주소 · 본문 · 비밀번호는 **어디에도 남지 않습니다.**
결과를 파일 · 아티팩트 · 캐시에 쓰지 않습니다. 계산은 그 실행의 메모리 안에서 끝납니다.
자세한 근거는 [`docs/privacy.md`](docs/privacy.md) 에 있습니다.

---

## 구조

```
core/                  계산 엔진 — 런타임 의존성 0개, DOM 없음
  calendar/              그레고리력 ↔ 율리우스일수, 한국 시간
  solar_terms/           ΔT, 태양 겉보기 황도, 24절기
  lunar/                 음력 ↔ 양력
  pillars/               60간지, 네 기둥
  ten_gods/              십신
  hidden_stems/          지장간
  twelve_stages/         십이지운성
  elements/              오행 분포, 일간 강약
  yongshin/              용신·희신
  interactions/          합·충·형·파·해
  daeun/                 대운
  periods/               세운·월운·일운
  fortune/               운의 계층 조립 (해석하지 않는다)
  interpretation/        신호 → 해석 (계산하지 않는다)
  text/                  한국어 조사 처리

data/                  데이터 — 계산 로직과 분리
  lunar/lunarInfo.ts      1900–2100 음력표
  regions/regions.ts      17 시도 · 228 시군구
  rules/rules.ts          규칙 49개 (설명)
  rules/terms.ts          용어집 70개 (설명)

web/                   화면 — 계산하지 않는다
  dom.ts                  작은 DOM 헬퍼
  format.ts               표시용 서식
  state.ts                저장소 상태
  components.ts           공통 조각 (카드·대화상자·용어·규칙 링크)
  pages/                  화면별 조립

email/                 하루치 이메일
  env.ts                  Secrets 읽기
  smtp.ts                 최소 SMTP 클라이언트 (암호화 연결)
  template.ts             본문 만들기
  main.ts                 실행 진입점

tests/                 561개
tools/                 픽스처 재생성 스크립트
docs/                  문서
```

### 지켜지는 경계

| 규칙 | 이유 |
| --- | --- |
| `core/` 는 DOM 을 모르고 의존성이 없다 | 웹과 이메일이 **같은 계산**을 하기 위해서 |
| `web/` 은 계산하지 않는다 | 계산이 두 곳에 생기면 갈라진다 |
| `core/interpretation/` 은 계산하지 않는다 | `core/fortune/` 가 계층을 **조립만** 하고 해석은 따로 |
| `data/` 는 설명만 담는다 | 규칙 설명을 바꿔도 계산 결과는 안 바뀐다 |
| 용어집은 `core/index.ts` 로만 나온다 | 한 군데서만 들어오게 해 흐름을 끊지 않는다 |

### 빌드 결과

```
dist/index.html                 1.54 kB  │ gzip  0.92 kB
dist/assets/index-*.css        17.40 kB  │ gzip  4.44 kB
dist/assets/index-*.js        164.67 kB  │ gzip 54.44 kB
```

런타임 의존성 0개, 모듈 48개, 빌드 0.6초. 폰트·CDN·외부 스크립트도 없다.

### 공개 API

화면과 이메일이 **같은 것만** 가져옵니다. 전부 `core/index.ts` 에서 나온다.

```ts
analyzeBirth(input)        // 출생 정보 → 원국 (사주·오행·강약·용신·대운)
analyzeFortune(saju, date) // 원국 + 날짜 → 그날의 운세 (해석·근거·드릴다운)
comparePeriods(a, b)       // 두 기간 비교 (좋고 나쁨을 정하지 않는다)
validateBirthInput(input)  // 사람이 읽을 오류 문장
convertCalendar(input)     // 음력 ↔ 양력
daeunOfDate(saju, date)    // 그 날짜에 걸린 대운
todayInKorea(nowMs?)       // "한국의 오늘" — 웹과 이메일이 공유
```

---

## 계산 — 무엇을 기준으로 삼는가

짧게만. 자세한 것은 [`docs/calculation-rules.md`](docs/calculation-rules.md).

| 항목 | 기준 |
| --- | --- |
| 시간 | KST = UTC+9 고정. 서머타임 4개 구간(1948·1951·1987·1988)만 UTC+10 |
| 절기 | Meeus 저정밀도 태양 겉보기황도 + 행성 섭동. ΔT 는 Espenak–Meeus |
| 절기 정확도 | HKO 192건 대비 **최대 13.93분 · 평균 3.60분 · 날짜 192/192 일치** |
| 월주 | 12 節(중기는 제외) + 五虎遁 |
| 년주 | 입춘 기준. `(절기년 − 1984) mod 60` |
| 일주 | `(JDN + 49) mod 60` |
| 시주 | 五子遁. 자시는 조자시/자정을 **선택** |
| 지장간 | 《三命通會》 통월 표. 본기 1.0 / 중기 0.5 / 여기 0.3 |
| 십이지운성 | 양간 순행 · 음간 역행 |
| 용신·희신 | **규칙 하나** (`RULE_YONGSHIN_001`). 유파를 섞지 않는다 |
| 대운 | 인접 節 까지의 일수 ÷ 3 = 기산 나이 |
| 음력 | 1900–2100 표 (UTC+8 기준). 지원 범위 1900-01-31 ~ 2100-12-31 |
| 반합 vs 삼합 | 두 자는 **반합**(세기 1~2), 세 자는 **완성**(세기 3). 섞어 세지 않는다 |
| 기세(강약) | 계층당 최대 신호 하나씩만 더하고, 계층별 천장으로 나눈 **비율**로 5단계 |

**같은 개념에 여러 학교가 있으면 하나를 고릅니다.** 섞지 않습니다.
어느 쪽을 골랐는지는 규칙 카탈로그에 다 적혀 있습니다.

### 오차에 대해 정직하게

절기 계산에는 **최대 약 14분**의 오차가 있습니다. (192건 중 최대, 평균 3.6분)
날짜는 192건 전부 맞고, 입력 단위가 2시간(시진)이므로 **시진이 뒤집힌 사례도 없습니다.**
그래도 경계일 계산에서는 이 오차를 감안해 절기 당일과 직전일을 함께 검증합니다.

진태양시는 보정하지 않습니다. (경도에 따라 기준이 갈리므로 벽시계로 통일했습니다)

---

| 파일 | 확인하는 것 |
| --- | --- |
| `solarTerms` | HKO 192건 대비 오차, 절기 순서·간격, 경계 시각, ΔT 연속성 |
| `lunar` | 설날 200건, 윤달, 假閏月 4곳, 표 밖 거절 |
| `pillars` | 입춘 직전·직후, 자시 경계, 날짜 경계, 12시진 전부, 시주 미상 |
| `daeun` | 기산 산출, 순역, 기산 이전 상태 |
| `periods` | 세운·월운·일운, 경계일, 월운 구간 |
| `interactions` | 합·충·형·파·해의 대상 조합 |
| `elements` / `interpretation` | 오행 분포, 강약 판정, 용신 규칙, 근거 정렬, 드릴다운, **기세가 뭉치지 않는지** |
| `koreaTime` | KST 경계, 서머타임 4구간, `todayInKorea()` |
| `determinism` | 같은 입력 → 같은 출력. 순회 순서에도 흔들리지 않는다 |
| `email` | 웹과 **같은 본문**, 금지 표현 없음, SMTP 조립, **개인정보가 새지 않는 구조** |
| `rules` / `publicApi` | 규칙 카탈로그가 완전하고 죽은 규칙이 없다 |
| `korean` | 조사(조사·목적어·topic)가 맞는지 |

## 고지

Myeong 은 **전통 명리학의 고정된 규칙집**으로 계산합니다.
과학적으로 검증된 방법이 아니며, 미래를 예측하는 도구가 아닙니다.
참고 자료로만 읽어 주세요.

---

## 개인정보

- 출생 정보는 **브라우저에만** 남습니다. 서버로 나가지 않습니다.
- 언제든 **설정 화면에서 삭제**할 수 있습니다. 지우면 남는 것이 없습니다.
- 이메일이 보내는 작업은 **GitHub Actions Secrets** 에서 값을 읽어 그 자리에서 계산하고 끝냅니다.
- 계산 결과를 파일 · 아티팩트 · 캐시에 **쓰지 않습니다.**
- 로그에는 단계 이름만 남습니다.

**[`docs/privacy.md`](docs/privacy.md) 를 읽어 주세요.** 특히
"저장소에 개인정보를 넣지 않는다" 와 "GitHub 의 비밀값 마스킹에 기대지 않는다" 부분.

---

## 문서

| 문서 | 내용 |
| --- | --- |
| [`docs/calculation-rules.md`](docs/calculation-rules.md) | 무슨 기준으로 계산하는가. 경계 사례와 오차 |
| [`docs/data-sources.md`](docs/data-sources.md) | 어디서 온 자료인가. 얼마나 검증했는가 |
| [`docs/privacy.md`](docs/privacy.md) | 무엇을 남기지 않는가 |

화면 안에서도 볼 수 있습니다 — **용어집** · **규칙 카탈로그**.

---

## 라이선스

MIT — [`LICENSE`](LICENSE)

데이터 출처의 라이선스는 [`docs/data-sources.md`](docs/data-sources.md) 에 적어 두었습니다.

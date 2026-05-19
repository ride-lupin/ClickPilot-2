# 브라우저 요소 자동화 구현 계획 한글 참고본

이 문서는 `docs/superpowers/plans/2026-05-19-browser-element-automation.md`의 참고용 한글본이다. 실제 구현 체크리스트와 코드 예시는 영문 원본 문서를 기준으로 한다.

## 목표

ClickPilot을 단순 화면 좌표 클릭 앱에서 사무직 직원이 쓰기 쉬운 브라우저 업무 자동화 앱으로 전환한다.

사용자는 개발자 도구나 CSS selector를 몰라도 된다. ClickPilot에서 작업을 만들고, 기존 Chrome 또는 Edge 탭에서 자동 클릭할 버튼을 직접 선택한 뒤, 정해진 시간에 실행되도록 저장한다.

## 핵심 구조

- 데스크톱 앱: Tauri + React + Rust
- 버튼 선택: Chrome/Edge Manifest V3 확장 프로그램
- 예약 실행: Playwright/CDP sidecar runner
- 저장소: 로컬 JSON
- 실행 로그: 성공/실패 상태, 실패 사유, 스크린샷 경로 저장
- 배포: Windows/macOS 실행 프로그램 제공 + 초기 내부 사용자는 Chrome/Edge `Load unpacked` 수동 설치

## 기본 사용자 흐름

1. 사용자가 ClickPilot에서 `새 작업`을 누른다.
2. `브라우저 버튼 선택`을 누른다.
3. 기존 Chrome 또는 Edge 탭에서 원하는 버튼을 클릭한다.
4. 확장 프로그램이 URL, selector 후보, 버튼 문구, frame 정보, 요소 내부 클릭 위치를 캡처한다.
5. 사용자가 스케줄을 입력한다.
6. 사용자가 실행 전 로그인 확인을 완료한다.
7. 예약 시간이 되면 선택한 실행 방식에 따라 전용 자동화 브라우저를 열거나 기존에 열려 있는 Chrome/Edge 탭을 찾는다.
8. 로그인 상태를 확인한다.
9. 버튼이 나타날 때까지 기다린다.
10. 버튼을 클릭한다.
11. 실행 결과와 스크린샷을 로그에 저장한다.

## 주요 결정

- Chrome/Edge를 1차 지원 대상으로 한다.
- Safari는 이번 구현 범위에서 제외한다.
- 기존 사용자가 쓰는 일반 브라우저 탭에서 버튼을 쉽게 선택하기 위해 확장 프로그램을 사용한다.
- 회사 내부 소수 사용자에게 최대한 빠르게 배포하기 위해 1차 운영 방식은 Chrome/Edge `Load unpacked` 수동 설치로 한다.
- 예약 실행은 안정성이 중요하므로 Playwright/CDP runner가 담당한다.
- 실행 방식은 두 가지를 지원한다. 안정성이 중요한 예약 작업은 ClickPilot 전용 자동화 프로필을 사용하고, 사용자가 이미 열어둔 세션을 반드시 써야 하는 작업은 기존 Chrome/Edge 탭을 확장 프로그램으로 제어한다.
- 화면 절대 좌표가 아니라 HTML 요소 정보와 요소 내부 상대 좌표를 저장한다.
- 기존 OS 좌표 클릭 기능은 fallback으로 유지한다.
- CAPTCHA 우회, 광고 클릭, 봇 탐지 회피, 보안 우회는 지원하지 않는다.

## 기존 앱에서 반드시 개선할 점

- 새 작업 생성 기능을 유지한다.
- 좌표 fallback 캡처 버튼을 `2초 뒤 좌표 캡처`로 변경한다.
- 좌표 캡처가 완료되면 `좌표 캡처가 완료되었습니다.` 메시지를 보여준다.
- 이미 추가된 클릭 단계를 개별 삭제할 수 있게 한다.
- 스케줄 설정을 사용자가 직접 입력할 수 있는 필드로 제공한다.
- 이미 생성된 작업을 삭제할 수 있게 한다.
- 생성된 작업을 즉시 실행할 수 있게 한다.
- 활성화된 작업은 저장된 스케줄에 맞춰 예약 실행되게 한다.

## 실행 방식

생성된 작업은 두 방식으로 실행한다.

첫 번째는 즉시 실행이다. 사용자는 작업 목록 또는 작업 상세 화면에서 `즉시 실행`을 눌러 저장된 작업을 바로 실행할 수 있다. 실행이 시작되면 `작업 실행을 시작했습니다.` 메시지를 보여준다.

두 번째는 예약 실행이다. 사용자가 스케줄을 저장하고 작업을 활성화하면 ClickPilot이 다음 실행 시간을 계산해 보여준다. 예약 실행은 앱이 완전히 종료되지 않고 tray/menu bar 프로세스로 살아 있을 때 동작한다. 메인 창은 닫혀 있어도 된다.

브라우저 실행 대상은 두 가지다.

- `전용 자동화 브라우저`: ClickPilot이 전용 Chrome/Edge 프로필을 직접 열어 실행한다. 사용자가 자리를 비운 예약 실행에 더 안정적이다.
- `기존에 열려 있는 브라우저 탭`: 사용자가 이미 열어둔 Chrome/Edge 탭을 확장 프로그램이 찾아서 클릭한다. 기존 로그인 세션을 그대로 써야 할 때 필요하다. 단, 브라우저와 대상 탭이 계속 열려 있어야 하고 확장 프로그램이 연결되어 있어야 한다.

## 데이터 모델 방향

작업 단계는 두 종류로 나눈다.

```ts
type AutomationStep = BrowserElementStep | ScreenCoordinateStep;
```

기본 단계는 브라우저 요소 클릭이다.

```ts
type BrowserElementStep = {
  kind: "browserElement";
  urlPattern: string;
  selectorCandidates: SelectorCandidate[];
  textHint?: string;
  framePath: FrameTarget[];
  clickOffsetRatio: { x: number; y: number };
  wait: BrowserWaitPolicy;
  retry: BrowserRetryPolicy;
  delayAfterMs: number;
};
```

좌표 클릭은 보조 단계로 유지한다.

```ts
type ScreenCoordinateStep = {
  kind: "screenCoordinate";
  x: number;
  y: number;
  button: MouseButton;
  clickCount: number;
  delayAfterMs: number;
};
```

## 구현 태스크 요약

1. 브라우저 단계 데이터 모델 추가
2. 브라우저 작업 검증 규칙 추가
3. Chrome/Edge 버튼 선택 확장 프로그램 구현
4. 확장 프로그램과 Tauri 앱 사이의 로컬 캡처 브릿지 구현
5. Playwright/CDP sidecar runner 구현
6. Tauri에서 sidecar runner 호출
7. 브라우저 단계와 좌표 fallback 단계를 함께 실행하도록 runner 개선
8. 기존 작업 관리 UX 개선
9. 로그인 설정 및 로그인 확인 UX 추가
10. 예약 전 브라우저 preopen 및 버튼 대기 기본값 추가
11. 실행 로그와 스크린샷 저장 추가
12. Windows/macOS 실행 프로그램 패키징
13. 최종 검증

## 수동 테스트 범위

- macOS 앱 설치 및 실행
- Windows 앱 설치 및 실행
- Chrome 확장 프로그램 `Load unpacked` 수동 설치 및 연결
- Edge 확장 프로그램 `Load unpacked` 수동 설치 및 연결
- 새 작업 생성
- `2초 뒤 좌표 캡처` 동작 확인
- 좌표 캡처 완료 메시지 확인
- 클릭 단계 개별 삭제 확인
- 스케줄 입력 필드 저장 확인
- 저장된 작업 즉시 실행 확인
- 활성화된 작업의 예약 실행 확인
- 저장된 작업 삭제 확인
- 기존 로그인된 탭에서 브라우저 버튼 선택
- 기존에 열려 있는 Chrome 탭에서 즉시 실행 확인
- 기존에 열려 있는 Edge 탭에서 즉시 실행 확인
- 자동화 프로필 로그인 확인
- 1분 뒤 실행 스케줄 저장
- 실행 전 브라우저 preopen 확인
- 버튼 대기 후 클릭 성공 확인
- selector 실패 시 스크린샷 저장 확인

## 배포 참고

데스크톱 앱은 Windows/macOS 실행 프로그램으로 배포한다. Chrome/Edge 확장 프로그램은 별도 설치가 필요하다.

초기 회사 내부 파일럿은 승인 절차를 기다리지 않고 Chrome/Edge `Load unpacked`로 `extension/dist`를 수동 설치하는 방식을 기본으로 한다. 설치 가이드에는 다음 절차를 포함한다.

1. ClickPilot 데스크톱 앱을 설치한다.
2. 확장 프로그램 빌드 결과인 `extension/dist` 폴더를 사용자 PC에 전달한다.
3. Chrome은 `chrome://extensions`, Edge는 `edge://extensions`를 연다.
4. 개발자 모드를 켠다.
5. `Load unpacked`를 눌러 `extension/dist` 폴더를 선택한다.
6. ClickPilot 앱에서 확장 프로그램 pairing 상태를 확인한다.
7. 실제 업무 사이트에서 `브라우저 버튼 선택`과 즉시 실행을 검증한다.

이 방식은 소수 사용자에게 가장 빠르게 배포할 수 있지만, 자동 업데이트가 없고 사용자가 확장 폴더를 삭제하거나 이동하면 동작하지 않는다. 사용자가 늘어나거나 장기 운영으로 전환할 때 Chrome Web Store 비공개 등록, Edge Hidden 등록, 또는 조직의 관리형 확장 배포 정책을 후속으로 검토한다.

# ClickPilot Manual Smoke Tests

## Desktop App

- [ ] macOS 앱을 설치하고 실행한다.
- [ ] Windows 앱을 설치하고 실행한다.
- [ ] command center에서 `새 작업`을 만든다.
- [ ] `2초 뒤 좌표 캡처`로 좌표 fallback 단계를 추가하고 `좌표 캡처가 완료되었습니다.` 메시지를 확인한다.
- [ ] 구성된 클릭 단계 하나를 삭제하고 나머지 단계가 유지되는지 확인한다.
- [ ] 스케줄 유형과 실행 시간을 수정한 뒤 저장한다.
- [ ] 저장된 작업을 `즉시 실행`하고 `작업 실행을 시작했습니다.` 메시지를 확인한다.
- [ ] 가까운 미래 스케줄로 활성 작업을 저장하고 앱이 떠 있는 동안 예약 실행되는지 확인한다.
- [ ] 저장된 작업을 삭제하고 목록에서 사라지는지 확인한다.

## Extension

- [ ] Chrome에서 `chrome://extensions`를 열고 개발자 모드를 켠다.
- [ ] `Load unpacked`로 `extension/dist`를 설치한다.
- [ ] Edge에서 `edge://extensions`를 열고 개발자 모드를 켠다.
- [ ] `Load unpacked`로 `extension/dist`를 설치한다.
- [ ] ClickPilot pairing token을 extension popup에 저장하고 연결 상태를 확인한다.
- [ ] 기존 로그인된 Chrome 탭에서 버튼을 선택한다.
- [ ] 기존 로그인된 Edge 탭에서 버튼을 선택한다.
- [ ] 기존에 열린 Chrome 탭 대상으로 즉시 실행한다.
- [ ] 기존에 열린 Edge 탭 대상으로 즉시 실행한다.

## Managed Profile Runner

- [ ] 자동화 프로필을 열고 대상 사이트에 로그인한다.
- [ ] 1분 뒤 실행 스케줄을 저장한다.
- [ ] 실행 전 preopen이 발생하는지 확인한다.
- [ ] 버튼 대기 후 클릭이 성공하는지 확인한다.
- [ ] 잘못된 selector로 실패 스크린샷이 저장되는지 확인한다.
- [ ] 로그인 실패, 버튼 미발견, 브라우저 미설치 실패 사유가 실행 로그에 표시되는지 확인한다.

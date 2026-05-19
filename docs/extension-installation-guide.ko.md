# ClickPilot 확장프로그램 설치 가이드

이 문서는 내부 파일럿 사용자가 Chrome 또는 Edge에 ClickPilot 확장프로그램을 수동으로 설치하고 ClickPilot 데스크톱 앱과 연결하는 절차를 정리합니다.

## 설치 전 준비

- ClickPilot 데스크톱 앱을 먼저 설치하고 실행합니다.
- Chrome 또는 Edge가 설치되어 있어야 합니다.
- 확장프로그램 배포 폴더는 `extension/dist`입니다. 개발 환경에서는 아래 명령으로 다시 만들 수 있습니다.

```bash
npm install
npm --prefix extension install
npm --prefix extension run build
```

- 확장프로그램은 로컬 ClickPilot 앱과 `127.0.0.1:27183`로 통신합니다. 보안 프로그램이나 브라우저 정책이 localhost 통신을 막으면 연결에 실패할 수 있습니다.

## Chrome 설치

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다` 또는 `Load unpacked`를 클릭합니다.
4. ClickPilot 배포 폴더의 `extension/dist`를 선택합니다.
5. 확장 목록에 `ClickPilot Button Picker`가 표시되는지 확인합니다.
6. 주소창 오른쪽 확장프로그램 메뉴에서 ClickPilot 아이콘을 고정합니다.

## Edge 설치

1. Edge 주소창에 `edge://extensions`를 입력합니다.
2. 왼쪽 아래 또는 오른쪽 위의 `개발자 모드`를 켭니다.
3. `압축 풀린 항목 로드` 또는 `Load unpacked`를 클릭합니다.
4. ClickPilot 배포 폴더의 `extension/dist`를 선택합니다.
5. 확장 목록에 `ClickPilot Button Picker`가 표시되는지 확인합니다.
6. 주소창 오른쪽 확장프로그램 메뉴에서 ClickPilot 아이콘을 고정합니다.

## ClickPilot 앱과 연결

1. ClickPilot 데스크톱 앱을 실행합니다.
2. 작업 편집 화면에서 `브라우저 버튼 선택`을 클릭합니다.
3. 화면에 표시된 포트와 pairing token을 확인합니다. 기본 포트는 `27183`입니다.
4. 브라우저의 ClickPilot 확장프로그램 아이콘을 클릭합니다.
5. `Port`에 `27183`을 입력합니다.
6. `Pairing token`에 ClickPilot 앱에서 받은 토큰을 입력합니다.
7. `Save`를 클릭하고 상태가 `연결됨`으로 바뀌는지 확인합니다.

현재 pairing token은 만료 시간을 두지 않습니다. 한 번 확장프로그램에 저장하면 앱과 확장프로그램이 같은 토큰을 계속 사용하며, 앱을 재시작해도 저장된 토큰으로 연결 상태를 복원합니다. 연결 실패가 나오면 ClickPilot 앱에서 `토큰 갱신`을 눌러 새 토큰을 받은 뒤 저장합니다.

## 버튼 선택 확인

1. 자동화할 업무 사이트를 Chrome 또는 Edge에서 엽니다.
2. ClickPilot 앱에서 `브라우저 버튼 선택`을 클릭합니다.
3. 브라우저 탭에서 자동화할 버튼을 선택합니다.
4. ClickPilot 앱에 선택한 요소 이름과 URL이 표시되는지 확인합니다.
5. 작업 실행 방식으로 `기존에 열려 있는 브라우저 탭`을 사용할 경우, 실행 시점에도 같은 브라우저와 대상 탭이 열려 있어야 합니다.

## 업데이트 또는 재설치

수동 `Load unpacked` 설치는 자동 업데이트되지 않습니다. 새 빌드를 받으면 다음 순서로 교체합니다.

1. ClickPilot 앱과 브라우저를 닫습니다.
2. 새 `extension/dist` 폴더를 기존 위치에 덮어씁니다.
3. `chrome://extensions` 또는 `edge://extensions`에서 ClickPilot 확장프로그램의 새로고침 버튼을 클릭합니다.
4. 앱을 재시작했거나 연결 상태가 끊겼다면 ClickPilot 앱에서 새 token을 받아 다시 저장합니다.

폴더 위치를 옮긴 경우에는 기존 확장프로그램을 제거한 뒤 새 `extension/dist`를 다시 `Load unpacked`로 설치합니다.

## 문제 해결

- `연결 실패`: ClickPilot 앱이 실행 중인지, 포트가 `27183`인지, 앱에 표시된 token과 확장프로그램에 저장한 token이 같은지 확인합니다.
- 확장프로그램이 목록에 보이지 않음: `extension/dist/manifest.json`이 있는 폴더를 선택했는지 확인합니다. `extension` 상위 폴더를 선택하면 설치되지 않습니다.
- 버튼 선택이 ClickPilot에 표시되지 않음: 대상 사이트 탭을 새로고침하고, 확장프로그램을 새로고침한 뒤 다시 선택합니다.
- 기존 탭 실행이 실패함: 작업의 URL 패턴이 현재 열린 탭 URL과 맞는지, 대상 탭이 닫히지 않았는지 확인합니다.
- 회사 정책으로 개발자 모드가 막힘: Chrome Web Store 비공개 배포, Edge Add-ons 숨김 배포, 엔터프라이즈 정책 배포 중 하나로 전환해야 합니다.

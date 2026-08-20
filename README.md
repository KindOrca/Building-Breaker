# BUILDING BREAKER v3

브라우저에서 바로 실행되는 2D 건물 파괴 아케이드 게임입니다. 외부 프레임워크나 이미지 에셋 없이 HTML/CSS/JavaScript(Canvas + Web Audio)만 사용합니다.

## v3 수정 사항
- 캐릭터가 건물을 통과하지 않는 충돌 구조 유지
- 단순히 건물 옆에 부딪히는 것만으로는 HP가 감소하지 않음
- **캐릭터가 지면에 서 있는 상태에서 건물 하단이 머리 위로 내려와 끼이는 순간에만 HP 1 감소**
- `↓` 가드를 좌/우 방패가 아니라 **캐릭터 머리 위로 펼쳐지는 UP GUARD**로 변경
- UP GUARD가 내려오는 건물을 받아내면 건물이 짧게 위로 들리는 `GUARD LIFT` 반동 추가
- 실드 반동 시 Hit Stop, Screen Shake, 충격파, 파티클, 사운드 연출 추가
- 건물을 완전히 파괴했을 때 `setTimeout` 의존 대신 게임 내부 Next Building 타이머로 전환
- 다음 건물 대기 중 화면 상단에 `NEXT BUILDING N` 진행 UI 표시
- 다음 건물 생성 시 BUILDING/STAGE UI 및 약점 정보를 확실하게 재초기화
- v2의 상향 Z 공격, 빠른 Special 게이지, 강화된 타격감 유지

## 조작
- `← / →`: 이동
- `↑`: 점프
- `↓`: 위쪽 실드 / UP GUARD
- `Z`: 위쪽 공격
- `X`: 필살기
- `Enter / Z`: 시작 / 재시작

## GitHub Pages 배포
저장소 최상위(root)에 아래 파일들을 그대로 업로드합니다.

- `index.html`
- `style.css`
- `game.js`
- `.nojekyll`

그 후 GitHub 저장소 `Settings` → `Pages` → `Deploy from a branch` → `main` → `/(root)`를 사용하면 됩니다.

별도 npm 설치나 빌드 과정은 필요하지 않습니다.

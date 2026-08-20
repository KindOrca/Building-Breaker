# BUILDING BREAKER v2

브라우저에서 바로 실행되는 2D 건물 파괴 아케이드 게임입니다. 외부 프레임워크나 이미지 에셋 없이 HTML/CSS/JavaScript(Canvas + Web Audio)만 사용합니다.

## v2 수정 사항
- 캐릭터가 건물을 통과하지 않도록 건물 충돌 판정 추가
- 건물과 몸이 닿는 것만으로는 HP가 감소하지 않음
- 건물이 지면에 실제로 닿을 때 HP 1 감소 (가드로 막을 수 없는 지면 충격)
- `Z` 공격 방향을 좌/우 공격에서 **캐릭터 바로 위쪽 상향 공격**으로 변경
- 공중 `Z`도 옆 돌진 대신 짧은 상향 돌진으로 변경
- Special 게이지 충전 속도 상향
- 일반 타격/Perfect Smash/층 파괴의 Hit Stop, Screen Shake, Flash, Camera Zoom 강화
- 이중 충격파 + 방사형 Impact Ray + 파편 수 증가로 타격감 강화
- 필살기 피니시 연출 강화

## 조작
- `← / →`: 이동
- `↑`: 점프
- `↓`: 가드
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

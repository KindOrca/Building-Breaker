# BUILDING BREAKER

브라우저에서 바로 실행되는 2D 건물 파괴 아케이드 게임입니다. 외부 프레임워크나 이미지 에셋 없이 HTML/CSS/JavaScript(Canvas + Web Audio)만 사용합니다.

## 조작
- `← / →`: 이동
- `↑`: 점프
- `↓`: 가드
- `Z`: 공격
- `X`: 필살기
- `Enter / Z`: 시작 / 재시작

## 로컬 실행
`index.html`을 직접 열어도 실행되지만, 브라우저 정책에 따라 로컬 서버 사용을 권장합니다.

```bash
python -m http.server 8000
```

그 후 `http://localhost:8000` 접속.

## GitHub Pages 배포
1. 새 GitHub 저장소 생성
2. 이 폴더의 `index.html`, `style.css`, `game.js`를 저장소 루트에 업로드
3. GitHub 저장소 `Settings` → `Pages`
4. `Build and deployment`에서 `Deploy from a branch`
5. Branch를 `main`, 폴더를 `/(root)`로 선택 후 Save
6. 생성된 GitHub Pages 주소로 접속

별도 빌드 과정이 필요하지 않습니다.

# Palette Rack WMS — 맥북 셋업 가이드

## 1. Homebrew + Node.js 설치 (없는 경우)

```bash
# Homebrew 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 설치
brew install node
```

---

## 2. 저장소 클론

```bash
git clone https://github.com/jkstory2011/Palette-Rack-WMS.git
cd Palette-Rack-WMS
```

---

## 3. 패키지 설치

```bash
npm install
```

---

## 4. 환경변수 파일 생성

> `.env.local` 은 보안상 Git에 포함되지 않으므로 직접 생성해야 합니다.

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://pujcsmlnfcllsgazucen.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_4Gj8yvb3VCnq9rkOXPqiVg_sB-ZbTrS
SITE_PASSWORD=wjdgkdbs5049?
EOF
```

---

## 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 열면 바로 시작됩니다.

---

## 양쪽 PC에서 작업할 때 규칙

```bash
# 작업 시작 전 (항상)
git pull origin main

# 작업 완료 후 (항상)
git add .
git commit -m "작업 내용 간단히"
git push origin main
```

---

## 참고

| 항목 | 설명 |
| --- | --- |
| `.env.local` | 양쪽 PC 모두 직접 생성 필요 (위 4번 참고) |
| `node_modules` | 양쪽 PC 모두 `npm install` 각자 실행 |
| Supabase DB | 클라우드 공유 — 어디서 작업해도 데이터 동일 |

---

## Windows 작업 시 주의사항 (2026-07-02)

**절대 Google Drive 동기화 폴더(`내 드라이브`, H: 드라이브 등) 안에서 작업하지 말 것.**

`npm install` / `next dev`가 대량의 작은 파일을 빠르게 쓰는데, Google Drive 스트리밍 드라이브가 이를 못 버티고 파일이 0바이트로 잘려서 저장되는 문제가 발생함 (`node_modules` 내 18,000개 이상 파일 손상, 재부팅해도 재발). 반드시 로컬 디스크(`D:\Palette Rack WMS`)에서만 작업할 것.

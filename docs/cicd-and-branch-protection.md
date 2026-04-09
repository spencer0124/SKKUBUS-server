# CI/CD 및 브랜치 보호 전략

## CI/CD 파이프라인

### 트리거

`main` 브랜치에 push (PR 머지 포함) 시 자동 실행.

### 워크플로우 (`deploy.yml`)

```
main push
  └→ GitHub Actions
       ├→ [test] npm ci → npm test → npm run lint
       └→ [deploy] (test 통과 후)
            └→ SSH로 OCI 서버 접속 (appleboy/ssh-action)
                 ├→ git pull origin main
                 ├→ Nginx 설정 업데이트
                 ├→ docker compose build
                 ├→ Rolling update (api-1 → api-2 → poller)
                 └→ 각 서비스 health check
```

### Rolling Update 순서

1. `api-1` 재시작 → 15초 대기 → health check (`/health/ready`)
2. `api-2` 재시작 → 15초 대기 → health check (`/health/ready`)
3. `poller` 재시작 → 10초 대기 → 상태 확인

api-1, api-2가 순차 배포되므로 다운타임 없음.

### 배포 대상

| 항목 | 값 |
|---|---|
| 서버 | OCI ARM VM (168.107.62.58) |
| 유저 | ubuntu |
| 경로 | `/home/ubuntu/skkumap-server-express` |
| 도메인 | api.skkuverse.com (Cloudflare → Nginx → Docker) |
| Docker 네트워크 | `skkuverse` (external) |

### 서비스 구성

| 서비스 | 포트 | 리소스 | 역할 |
|---|---|---|---|
| api-1 | 127.0.0.1:3001 | 384MB / 0.75 CPU | API (로드밸런싱) |
| api-2 | 127.0.0.1:3002 | 384MB / 0.75 CPU | API (로드밸런싱) |
| poller | — | 256MB / 0.5 CPU | 백그라운드 작업 |

### AI 서비스 연동

백엔드는 `skkuverse` Docker 네트워크를 통해 AI 서비스에 접근:
- `http://ai:4000/v1/chat/completions` — 범용 채팅
- `http://ai:4000/api/notices/summarize` — 공지 요약

### GitHub Secrets

| Secret | 용도 |
|---|---|
| `ORACLE_VM_HOST` | OCI 서버 IP |
| `ORACLE_VM_USER` | SSH 유저 |
| `SSH_PRIVATE_KEY` | SSH 개인키 |
| `DEPLOY_PATH` | 배포 경로 |

---

## 브랜치 보호 (GitHub Rulesets)

### 규칙

| 규칙 | 설명 |
|---|---|
| PR 필수 | main 직접 push 차단. PR → CI 통과 → 머지 |
| required_status_checks | `test` + `deploy` job 통과 필수 |
| non_fast_forward | force push 방지 |
| deletion | main 브랜치 삭제 방지 |

### Bypass

- **Repository Admin**: 긴급 시 직접 push 가능 (bypass_mode: always)
- **GitHub Actions bot**: bypass 불필요 (deploy workflow가 main에 push하지 않음)

### 워크플로우

```
feature branch 생성
  └→ 작업 & 커밋
       └→ PR 생성 (main ← feature)
            └→ CI 자동 실행 (test → deploy)
                 ├→ 통과 → 머지 가능
                 └→ 실패 → 머지 차단
```

### 자동 Rollback

배포 스크립트에 자동 rollback 내장. rolling update 중 health check 실패 시:

1. 배포 전 커밋 해시 저장 (`PREV_COMMIT`)
2. api-1 또는 api-2 health check 30초간 retry (5초 × 6회)
3. 실패 시 `git checkout $PREV_COMMIT` → 이전 이미지로 api-1, api-2, poller 전체 복원
4. CI는 실패로 표시 (GitHub에서 확인 가능)

### 긴급 hotfix

Admin은 bypass 권한이 있으므로 main에 직접 push 가능. 단, 의도적으로만 사용할 것.

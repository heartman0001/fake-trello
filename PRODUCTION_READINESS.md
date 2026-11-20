# Production Readiness Plan

> **Project:** Fake Trello (Next.js 14 + NestJS + PostgreSQL + Socket.io)
> **Last updated:** 2026-11-20
> **Status:** Draft — ยังไม่พร้อมขึ้น Production
> **Purpose:** แผนงานและ checklist สำหรับทีม/AI ใช้ tracking ก่อนเปิดใช้งานจริง

---

## วิธีใช้ไฟล์นี้กับ AI

1. หยิบงานทีละ task ตามลำดับ `P0-01`, `P0-02`, ... เว้นแต่มี dependency ระบุไว้เป็นอย่างอื่น
2. เปลี่ยน `[ ]` เป็น `[x]` **หลังตรวจ acceptance criteria และคำสั่ง verify ผ่านแล้วเท่านั้น**
3. ถ้างานยังไม่เสร็จให้คง `[ ]` และเพิ่มบันทึกสั้น ๆ ใต้ task เช่น
   `Status: blocked — รอเลือกผู้ให้บริการ managed PostgreSQL`
4. ห้าม mark task ว่าเสร็จเพราะเขียนโค้ดแล้ว แต่ยังไม่ได้รัน verification
5. ถ้า task ต้องใช้ credential, cloud account, โดเมน หรือการตัดสินใจเชิงธุรกิจ ให้หยุดและขอ confirmation ก่อน
6. เมื่อแก้ task ใด ให้อัปเดต `Last updated` ด้านบนและเพิ่ม entry ใน [Change Log](#change-log)

### สถานะที่ใช้

- `[ ]` TODO
- `[x]` DONE — ผ่าน acceptance และ verification แล้ว
- `Status: in progress` — กำลังทำ
- `Status: blocked` — ติด dependency หรือต้องตัดสินใจ
- `Status: deferred` — เลื่อนออกจากรอบ launch โดยระบุเหตุผล

### Priority

- **P0 — Launch blocker:** ขาดไม่ได้ก่อนรับผู้ใช้จริง
- **P1 — Launch hardening:** ควรเสร็จก่อนเปิด public หรือภายในสัปดาห์แรก
- **P2 — Post-launch:** ทำหลัง launch ได้ แต่ต้องมีเจ้าภาพและ timeline

---

## Baseline ที่ตรวจแล้ว (2026-11-20)

### ผ่านแล้ว

- [x] `@fake-trello/shared` build ผ่าน
- [x] API `tsc --noEmit` ผ่าน
- [x] Web `tsc --noEmit` ผ่าน
- [x] API `nest build` ผ่าน
- [x] Web `next build` ผ่าน
- [x] Docker Compose build/start ผ่าน
- [x] E2E ของ web ผ่าน **15 tests** ใน 4 spec files
- [x] มี Prisma migration history (`prisma/migrations/`)
- [x] มี security fix สำหรับ nested resource ownership และ cross-account cache แล้ว
- [x] มี healthcheck ใน `docker-compose.yml` ระดับ container

### ช่องว่างที่ยืนยันจาก repo

- [ ] `pnpm test` **fail** เพราะ API ไม่มี `jest` ใน dependencies และไม่มี test files
- [ ] ยังไม่มี CI/CD workflow (`.github/workflows` ไม่มี)
- [ ] ยังไม่มี unit/integration tests ฝั่ง API
- [ ] Docker production ยังใช้ `prisma db push` และมี default secret
- [ ] PostgreSQL และ API expose port ออก host โดยตรง
- [ ] Token ถูกเก็บใน cookie ที่ JavaScript อ่านได้ และ access token อายุ 7 วัน
- [ ] Refresh token endpoint มีอยู่ แต่ frontend ไม่ได้ใช้ refresh flow
- [ ] ไม่มี rate limiting, email verification, password reset หรือ session revocation
- [ ] Socket.io ยังไม่มี Redis adapter และไม่ kick socket เมื่อสมาชิกถูกถอดสิทธิ์
- [ ] ไม่มี `/health/live`, `/health/ready` หรือ dependency-aware health check
- [ ] ไม่มี structured logging, metrics, tracing, error tracking หรือ alerting
- [ ] ไม่มี backup/restore automation หรือ disaster recovery runbook
- [ ] ไม่มี production compose/deployment manifest, TLS/reverse proxy หรือ secret manager
- [ ] `.env.example` ไม่ตรงกับ environment ที่โค้ดใช้จริง (port, path, ตัวแปรที่ขาด)
- [ ] `packages/shared/src/constants.ts` มี hardcoded JWT fallback secrets
- [ ] README ระบุ API port 3001 แต่ stack จริงใช้ 4000
- [ ] ไม่มี ESLint config ที่ชัดเจน และ `next lint`/API lint ยังไม่เป็น CI gate
- [ ] Font Itim โหลดผ่าน Google ตอน build ทำให้ build ต้องพึ่ง network ภายนอก

---

## P0 — Launch Blockers

### P0-01 — ทำ environment contract และ startup validation ให้ชัดเจน

- [ ] สร้างรายการ env ที่จำเป็นทั้งหมดสำหรับ API และ web
- [ ] แยก dev / staging / production อย่างชัดเจน
- [ ] เพิ่ม validation ตอน boot: ถ้า secret หาย, เป็นค่า default, สั้นเกินไป หรือ URL ผิด ให้ process exit ทันที
- [ ] ลบ hardcoded fallback secrets ใน `packages/shared/src/constants.ts`
- [ ] ลบ default secret ใน `docker-compose.yml` หรือย้ายไปไฟล์ compose สำหรับ dev เท่านั้น
- [ ] แก้ `.env.example` ให้ตรงกับ stack จริง: `PORT`, `FRONTEND_URL`, `API_PUBLIC_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `POSTGRES_*`, JWT expiry
- [ ] เพิ่ม `.env.production.example` โดยไม่มีค่าจริง
- [ ] ตรวจว่า `.env*` ถูก ignore และไม่มี secret ถูก bake ลง image

**Files:** `.env.example`, `docker-compose.yml`, `apps/api/src/app.module.ts`, `packages/shared/src/constants.ts`

**Acceptance:**
- API start ไม่ได้ถ้า `JWT_ACCESS_TOKEN_SECRET` หรือ `JWT_REFRESH_TOKEN_SECRET` หาย/เป็นค่า default
- ไม่มี secret จริงใน git หรือ image layer
- env ทั้งหมดมี documentation และ example ครบ

**Verify:**
```bash
docker compose config
# ทดสอบ boot โดยไม่ใส่ secret แล้วต้อง fail อย่างชัดเจน
```

---

### P0-02 — เปลี่ยนระบบ auth เป็น production-safe session model

- [ ] ลดอายุ access token เป็น 10–15 นาที
- [ ] ใช้ refresh token แบบ rotation และ revocation (เก็บ hash ใน DB หรือ session store)
- [ ] เก็บ refresh token ใน `HttpOnly`, `Secure`, `SameSite` cookie
- [ ] ถ้าใช้ cookie สำหรับ auth ต้องเพิ่ม CSRF protection ที่ endpoints ที่เปลี่ยน state
- [ ] ทำ logout ฝั่ง server เพื่อ revoke refresh session ไม่ใช่แค่ลบ cookie ฝั่ง client
- [ ] เพิ่ม session list/revoke-all สำหรับกรณี suspected compromise
- [ ] ลบ refresh token ออกจาก response body และ localStorage/cookie ที่ JS อ่านได้
- [ ] ห้ามส่ง token ทาง query string ของ Socket.io; ใช้ handshake auth เท่านั้น
- [ ] ตรวจว่า middleware เป็นเพียง UX guard ไม่ใช่ security boundary — API ต้องตรวจทุกครั้ง

**Files:** `apps/api/src/auth/*`, `apps/web/lib/api.ts`, `apps/web/lib/socket.ts`, `apps/web/src/middleware.ts`, `prisma/schema.prisma`

**Acceptance:**
- DevTools ไม่สามารถอ่าน refresh token ได้
- Logout แล้ว refresh token เก่าใช้ไม่ได้
- Access token หมดอายุแล้ว refresh ได้โดยไม่ต้อง login ใหม่
- ไม่มี token ใน URL, log หรือ query string

**Verify:**
- ทดสอบ stolen refresh token หลัง logout → `401`
- ทดสอบ refresh rotation และ reuse detection
- ตรวจ cookie flags ใน browser

> **หมายเหตุ:** การเปลี่ยนเป็น HttpOnly cookie ควรทำคู่กับ reverse proxy same-origin (P0-08) เพื่อลดปัญหา CORS/CSRF

---

### P0-03 — เพิ่ม rate limiting และป้องกัน credential attacks

- [ ] เพิ่ม rate limit ที่ `/auth/login`, `/auth/register`, `/auth/refresh`
- [ ] เพิ่ม rate limit ทั่วไปต่อ IP/user สำหรับ API
- [ ] เพิ่ม backoff หรือ lockout ชั่วคราวหลัง login ผิดหลายครั้ง
- [ ] พิจารณา CAPTCHA หรือ email verification สำหรับ open registration
- [ ] จำกัด request body size และ timeout
- [ ] ตรวจว่า error จาก login ไม่เปิดเผยว่า email มีอยู่หรือไม่

**Files:** `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/auth/*`

**Acceptance:**
- ยิง login ผิดติดกันเกิน threshold ได้ `429`
- ไม่มีทาง brute force ด้วยความเร็วสูงโดยไม่มีข้อจำกัด
- ขนาด body เกินกำหนดถูก reject

**Verify:**
- ทดสอบด้วย script ยิง request ต่อเนื่องและตรวจ `429`
- ตรวจ rate limit ไม่ block ผู้ใช้ปกติ

---

### P0-04 — ตั้ง CORS และ security headers แบบ fail-closed

- [ ] API CORS อนุญาตเฉพาะ origin ที่กำหนดใน production; ห้าม fallback เป็น `true`
- [ ] Socket.io CORS ใช้ allowlist เดียวกันและ fail closed
- [ ] เพิ่ม security headers: HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, frame protection
- [ ] ตรวจ CSP ให้รองรับ Next.js และ font assets
- [ ] ตั้ง `trust proxy` อย่างถูกต้องเมื่ออยู่หลัง reverse proxy
- [ ] ตรวจว่า error response ไม่ส่ง stack trace หรือ SQL รายละเอียดใน production

**Files:** `apps/api/src/main.ts`, `apps/api/src/realtime/realtime.gateway.ts`, `apps/web/next.config.js`

**Acceptance:**
- Origin ที่ไม่อยู่ใน allowlist ถูก reject
- ไม่มี `Access-Control-Allow-Origin: *` ร่วมกับ credentials
- Security headers ครบใน response

**Verify:**
- `curl -I` ตรวจ headers
- ทดสอบ WebSocket จาก origin แปลกปลอม

---

### P0-05 — ใช้ Prisma migration deploy แทน db push

- [ ] ตรวจว่า migration baseline ตรงกับ schema ปัจจุบัน
- [ ] ทดสอบ `prisma migrate deploy` กับ database เปล่า
- [ ] ทดสอบ upgrade จาก database ที่มีข้อมูลจริง/สำเนา production
- [ ] เปลี่ยน startup command ของ API เป็น `prisma migrate deploy` เท่านั้น
- [ ] ย้าย migration ไปเป็น one-off job/init container ไม่ให้ API ทุก replica แข่งกัน migrate
- [ ] เพิ่ม CI check ว่า schema กับ migrations ไม่ drift
- [ ] เตรียม rollback/forward-fix strategy สำหรับ migration ที่ destructive
- [ ] ห้ามรัน `db:seed` ใน production โดยอัตโนมัติ

**Files:** `docker-compose.yml`, `prisma/migrations/*`, `prisma/schema.prisma`, CI workflow

**Acceptance:**
- Fresh database สร้างได้ด้วย `migrate deploy`
- API ไม่เริ่มทำงานถ้า migration ล้มเหลว
- ไม่มี `db push` ใน production path

**Verify:**
```bash
prisma migrate deploy
prisma migrate status
```

---

### P0-06 — แยก demo seed ออกจาก production data

- [ ] แยก seed demo (`demo@fake-trello.com`) ออกจาก production โดยเด็ดขาด
- [ ] สร้าง admin bootstrap ที่ใช้ secret/env และรันครั้งเดียว
- [ ] ตรวจว่า production ไม่มี demo password หรือ seed board
- [ ] เพิ่ม guard ใน seed script ไม่ให้รันเมื่อ `NODE_ENV=production` เว้นแต่มี flag ชัดเจน
- [ ] กำหนดนโยบายลบ/retain ข้อมูล demo ใน staging

**Files:** `prisma/seed.ts`, deployment scripts, README

**Acceptance:**
- Production ไม่มีบัญชี demo
- Seed script ไม่สามารถรันโดยอุบัติเหตุใน production

---

### P0-07 — ทำ health/readiness และ graceful shutdown จริง

- [ ] เพิ่ม `GET /api/health/live` — process ยังทำงาน
- [ ] เพิ่ม `GET /api/health/ready` — ตรวจ DB และ dependency ที่จำเป็น
- [ ] แยก liveness/readiness ให้ orchestrator ใช้ถูก
- [ ] เพิ่ม `app.enableShutdownHooks()` และปิด Prisma/socket อย่างเรียบร้อย
- [ ] ตั้ง SIGTERM timeout ให้สอดคล้องกับ platform
- [ ] เปลี่ยน Docker healthcheck จาก “ยิง `/workspaces` แล้วได้อะไรก็ได้” เป็น endpoint ที่มีความหมาย
- [ ] เพิ่ม healthcheck ของ web ที่ไม่ผูกกับหน้า login อย่างเดียว

**Files:** `apps/api/src/main.ts`, `apps/api/src/prisma.service.ts`, `docker-compose.yml`, deployment manifests

**Acceptance:**
- `/api/health/ready` ตอบ `503` เมื่อ DB ใช้งานไม่ได้
- Pod/container ได้รับ SIGTERM แล้วปิดได้ภายใน grace period
- orchestrator ไม่ route traffic ไปยัง instance ที่ยังไม่พร้อม

**Verify:**
- หยุด PostgreSQL ชั่วคราวแล้ว readiness ต้อง fail
- ทดสอบ rolling restart

---

### P0-08 — สร้าง production deployment topology

- [ ] แยก `docker-compose.yml` สำหรับ local dev ออกจาก production manifest
- [ ] ไม่ expose PostgreSQL port ออก public
- [ ] ไม่ expose API port ออก public โดยตรง; ให้เข้าผ่าน reverse proxy/internal network
- [ ] ตั้ง reverse proxy หรือ platform routing ให้ web/API/socket อยู่ใต้โดเมนเดียว
- [ ] ตั้ง TLS, HTTP→HTTPS redirect, HSTS
- [ ] ใช้ secret manager หรือ platform secret store แทน env ใน compose
- [ ] ตั้ง resource limits, restart policy, non-root user, read-only filesystem ถ้าทำได้
- [ ] ตั้ง log driver/collection และจำกัด log retention
- [ ] กำหนด strategy สำหรับ rolling deploy และ rollback
- [ ] ตั้ง staging environment ที่แยก DB และ secret จาก production

**Acceptance:**
- เปิดจาก internet ได้เฉพาะ 443 (และ 80 สำหรับ redirect)
- Database ไม่มี public endpoint
- Container ไม่รันเป็น root
- Deploy และ rollback ได้โดยไม่ต้องแก้มือใน server

---

### P0-09 — ทำให้ test command ใช้งานได้และเป็น gate

- [ ] เพิ่ม `jest`, `ts-jest` และ config ที่จำเป็นใน API
- [ ] แก้ `pnpm test` ให้ผ่านหรืออย่างน้อย fail เฉพาะเมื่อมี test จริงล้ม
- [ ] เพิ่ม smoke test ขั้นต่ำสำหรับ auth และ health
- [ ] เพิ่ม script `typecheck`, `lint`, `test`, `test:e2e` ที่รันจาก root ได้สม่ำเสมอ
- [ ] ตรวจว่า CI ใช้ lockfile แบบ frozen
- [ ] ตั้ง coverage threshold ขั้นต่ำสำหรับ module สำคัญ (auth, guards, cards, analytics)

**Files:** `apps/api/package.json`, `apps/api/jest.config.*`, root `package.json`, CI workflow

**Acceptance:**
- `pnpm test` ผ่านใน local และ CI
- ไม่มี `jest: command not found`
- CI ไม่ผ่านถ้า typecheck/build/test fail

**Verify:**
```bash
pnpm install --frozen-lockfile
pnpm test
```

---

### P0-10 — เพิ่ม security regression tests

- [ ] ทดสอบ foreign workspace/board/column/card/comment/checklist access → `403/404`
- [ ] ทดสอบ `GET /auth/users` โดยไม่ส่ง `boardId` → `400`
- [ ] ทดสอบ user ที่ถูกถอดสิทธิ์แล้วแก้/ลบ comment ไม่ได้
- [ ] ทดสอบ board/workspace role boundaries (OWNER/ADMIN/MEMBER)
- [ ] ทดสอบ socket join board ที่ไม่มีสิทธิ์
- [ ] ทดสอบ socket ยังไม่ได้รับ event หลังถูกถอดสมาชิก
- [ ] ทดสอบ cross-account cache clearing หลัง logout/login
- [ ] เพิ่ม test สำหรับ token หมดอายุ/refresh/logout revocation
- [ ] รัน security suite ใน CI ทุก PR

**Acceptance:**
- Security tests ครอบคลุม endpoint สำคัญทั้งหมด
- ไม่มี test ที่พึ่งข้อมูล seed แบบ hardcoded จน flaky
- Test suite จับ regression ได้ก่อน merge

---

### P0-11 — จัดการสิทธิ์ realtime เมื่อสมาชิกถูกถอด

- [ ] เมื่อ remove board/workspace member ให้ socket ของ user นั้นออกจาก room ทันที หรือ
- [ ] ตรวจสิทธิ์ซ้ำก่อน emit event ทุกครั้ง
- [ ] ตรวจสิทธิ์ใน `board:join` ซ้ำกับ API guard
- [ ] จำกัด payload/rate ของ socket events
- [ ] เพิ่มการทดสอบว่า removed member ไม่ได้รับ `card:*`/`column:*` อีก
- [ ] กำหนด behavior ตอน role เปลี่ยน (viewer/editor)

**Files:** `apps/api/src/realtime/realtime.gateway.ts`, `apps/api/src/boards/boards.service.ts`, `apps/api/src/workspaces/workspaces.service.ts`

**Acceptance:**
- User ที่ถูกถอดสิทธิ์ไม่ได้รับ realtime data ใหม่
- Socket ที่ไม่มี token/สิทธิ์ถูก disconnect หรือ join ไม่สำเร็จ

---

### P0-12 — ทำ backup/restore และ disaster recovery ขั้นต่ำ

- [ ] เปิด automated backups สำหรับ PostgreSQL
- [ ] กำหนด retention และ encryption at rest/in transit
- [ ] กำหนด RPO/RTO ที่ยอมรับได้
- [ ] ทดสอบ restore ลง environment แยกจริง
- [ ] บันทึกขั้นตอน restore ใน runbook
- [ ] ตั้ง alert เมื่อ backup ล้มเหลว
- [ ] ตรวจว่า backup ไม่ได้อยู่ account/region เดียวกับ production ทั้งหมด

**Acceptance:**
- Restore จาก backup ล่าสุดได้ภายใน RTO
- มีหลักฐานการทดสอบ restore (วันที่, ผู้ทำ, ผล)
- Backup failure มี alert

---

### P0-13 — ตั้ง observability ขั้นต่ำ

- [ ] Structured JSON logs พร้อม request ID, user ID (แบบไม่เป็น PII เกินจำเป็น), route, status, latency
- [ ] Error tracking สำหรับ API และ web
- [ ] Metrics: request rate, error rate, latency p95/p99, DB pool, socket connections
- [ ] Dashboards สำหรับ API, DB, realtime
- [ ] Alerts: error rate, latency, DB down, backup failure, disk, certificate expiry
- [ ] Uptime check จากภายนอก
- [ ] Log retention และ redaction ของ token/password/PII
- [ ] แจ้งเตือนไปยังช่องทางที่มีคนเห็นจริง

**Acceptance:**
- มี dashboard และ alert ที่ทดสอบแล้ว
- ไม่มี secret/PII ใน logs
- ทีมรู้ว่าต้องดูอะไรเมื่อ alert ดัง

---

### P0-14 — ทำ frontend production configuration

- [ ] เปลี่ยน API/socket ให้เป็น same-origin ผ่าน reverse proxy หรือ runtime config
- [ ] ไม่ bake `NEXT_PUBLIC_API_URL` แบบ production-specific ลง image โดยไม่มีเหตุผล
- [ ] ใช้ `output: 'standalone'` และ image ที่เล็กลงสำหรับ Next.js
- [ ] รัน container ด้วย non-root user
- [ ] เพิ่ม error boundary, loading state และ 404 ที่เหมาะสม
- [ ] ตรวจ cookie handling หลังเปลี่ยนเป็น HttpOnly
- [ ] Self-host ฟอนต์ Itim หรือ pin asset ไว้ใน repo เพื่อไม่ให้ build พึ่ง Google
- [ ] ตรวจว่า logout/login ไม่ทำให้ข้อมูลบัญชีเดิมค้าง (test ที่มีอยู่ต้องคงอยู่)

**Acceptance:**
- Production build และ runtime ไม่พึ่ง network ภายนอกสำหรับ font
- ไม่มี CORS ที่ไม่จำเป็น
- หน้า error ไม่เผย internals

---

## P1 — Launch Hardening

### P1-01 — เพิ่ม API unit/integration test coverage

- [ ] Unit tests: guards, auth service, fractional ordering, analytics calculations
- [ ] Integration tests กับ PostgreSQL จริง/Testcontainers
- [ ] Contract tests ระหว่าง shared validators กับ controllers
- [ ] Test transaction/rollback ของ operation สำคัญ
- [ ] เพิ่ม test สำหรับ auto-save race และ socket queue/flush
- [ ] ตั้ง coverage target ตามความเสี่ยง ไม่ใช่ไล่ตัวเลขทั้ง repo

### P1-02 — แยก E2E data ให้ไม่ชนกัน

- [ ] เปลี่ยนจาก demo seed ที่ทุก worker ใช้ร่วมกันเป็น fixture ต่อ test
- [ ] สร้าง workspace/board เฉพาะ test และ cleanup
- [ ] ตรวจ `fullyParallel` กับ test ที่ mutate ข้อมูล
- [ ] เพิ่ม test สำหรับ ConfirmDialog, logout ข้ามแท็บ, การถอดสิทธิ์
- [ ] เพิ่ม accessibility checks สำหรับ flow สำคัญ

**Files:** `apps/web/e2e/*`, `apps/web/playwright.config.ts`

### P1-03 — ทำ CI/CD pipeline

- [ ] Trigger บน PR และ main
- [ ] Stages: install → typecheck → lint → unit/integration → build → migration check → e2e → security scan
- [ ] ใช้ PostgreSQL service container สำหรับ integration/e2e
- [ ] Cache pnpm store อย่างปลอดภัย
- [ ] สร้าง image เฉพาะเมื่อ test ผ่าน
- [ ] สแกน dependency และ container image
- [ ] สร้าง SBOM และ pin image digest
- [ ] Deploy staging อัตโนมัติ และ production แบบ manual approval
- [ ] Smoke test หลัง deploy และ auto-rollback เมื่อ fail

### P1-04 — ปรับ Docker image ให้ production-grade

- [ ] Multi-stage build ที่ prune dev dependencies
- [ ] `output: 'standalone'` สำหรับ web
- [ ] Non-root user และ file permissions
- [ ] Pin base image version/digest
- [ ] ไม่ copy source/test ที่ไม่จำเป็นลง runtime
- [ ] ตั้ง `NODE_ENV=production`, memory limits และ `--max-old-space-size` ตาม workload
- [ ] ตรวจว่า Prisma engine ตรงกับ platform

### P1-05 — Database performance และ pagination

- [ ] วัด query plan ของ analytics ด้วยข้อมูลใกล้ production
- [ ] เพิ่ม index ตาม query จริง โดยไม่เพิ่ม index ซ้ำ
- [ ] จำกัดขนาด board detail, comments, activity, checklist ที่โหลดทีละครั้ง
- [ ] เพิ่ม pagination/limit สำหรับ activity และ comment ถ้าข้อมูลโตได้
- [ ] ตรวจ N+1 queries ใน board detail และ analytics
- [ ] ตั้ง connection pool ให้เหมาะกับ DB และจำนวน replica
- [ ] พิจารณา PgBouncer/managed pooler ถ้า scale หลาย instance

### P1-06 — Realtime scaling

- [ ] เพิ่ม Redis adapter สำหรับ Socket.io เมื่อมี API มากกว่า 1 instance
- [ ] ตั้ง sticky sessions สำหรับ polling transport
- [ ] ทดสอบ reconnect/backoff และ event replay หลัง network ขาด
- [ ] จำกัดจำนวน room ต่อ socket และ payload size
- [ ] Monitor จำนวน connections, event rate และ error rate

### P1-07 — ปรับ API hygiene

- [ ] แทน `@CurrentUser() user: any` ด้วย typed principal
- [ ] ตรวจ DTO/validation ของ body ที่ยังใช้ inline type เช่น role/member endpoints
- [ ] ใส่ global exception filter ที่ไม่ leak stack/SQL
- [ ] เพิ่ม request ID และ correlation ID
- [ ] ตรวจว่า `console.log` ถูกแทนด้วย logger
- [ ] จำกัด CORS, body size, timeout และ upload (ถ้ามี)
- [ ] เพิ่ม OpenAPI/Swagger สำหรับ staging หรือ internal docs

### P1-08 — Privacy และบัญชีผู้ใช้

- [ ] กำหนดนโยบายเก็บชื่อ/email และ data retention
- [ ] เพิ่มความสามารถ export/delete account ตามที่กฎหมายกำหนด
- [ ] เพิ่ม email verification และ password reset ถ้าเปิด public registration
- [ ] จำกัดการค้นหาผู้ใช้/invite ให้เฉพาะ role ที่ควรทำ
- [ ] Redact PII ใน logs และ error reports
- [ ] เตรียม Privacy Policy, Terms และ cookie notice ถ้าจำเป็น
- [ ] ตรวจ data processing agreement กับผู้ให้บริการ infrastructure

### P1-09 — Documentation และ developer experience

- [ ] แก้ README ให้ตรงกับ port 4000 และ `/api`
- [ ] อัปเดต `.env.example` และคำสั่ง setup
- [ ] เพิ่ม runbook: deploy, rollback, restore, incident, rotate secret
- [ ] เพิ่ม architecture diagram และ data flow
- [ ] เพิ่ม CONTRIBUTING และ coding/test conventions
- [ ] เพิ่มคำอธิบาย production topology และ backup policy

### P1-10 — Load และ capacity test

- [ ] กำหนด target: concurrent users, boards, cards, socket connections
- [ ] ทดสอบ read/write load ที่ board detail, move card, comments
- [ ] ทดสอบ analytics กับข้อมูลขนาดใกล้จริง
- [ ] วัด p95/p99 latency และ error rate
- [ ] ทดสอบ DB connection saturation
- [ ] บันทึก capacity limit และ scaling trigger

### P1-11 — Accessibility และ UX hardening

- [ ] ตรวจ keyboard flow ของ drag & drop, dialogs และ select
- [ ] ตรวจ focus management หลัง route change
- [ ] ตรวจ contrast และ font fallback (Itim มี weight เดียว)
- [ ] เพิ่ม loading/empty/error states ที่ยังขาด
- [ ] ทดสอบจอเล็กและ browser หลัก
- [ ] เพิ่ม reduced-motion และ prefers-color-scheme ตามต้องการ

### P1-12 — Dependency/supply chain

- [ ] เปิด automated dependency updates
- [ ] ตรวจ vulnerability scan และกำหนด SLA ในการแก้
- [ ] Pin เวอร์ชันที่สำคัญและตรวจ lockfile
- [ ] หลีกเลี่ยง dependency ที่ไม่ใช้
- [ ] ตรวจ license compatibility
- [ ] ตั้ง secret scanning และ push protection

---

## P2 — Post-launch

- [ ] Label management UI (backend มี CRUD แล้ว แต่ frontend ยังขาด)
- [ ] Assignee picker UI
- [ ] Activity feed UI
- [ ] Email invitations/notifications
- [ ] Analytics date-range filters และ live refresh
- [ ] Export CSV/JSON
- [ ] Dark mode
- [ ] Multi-region/HA ถ้าจำเป็น
- [ ] Fine-grained audit log UI
- [ ] Usage analytics และ product metrics

---

## Launch Gates

ก่อนกด deploy production ต้องผ่านทั้งหมดนี้:

- [ ] P0 ทุกข้อ `[x]`
- [ ] `pnpm install --frozen-lockfile` ผ่าน
- [ ] typecheck API/web/shared ผ่าน
- [ ] lint ผ่าน
- [ ] unit/integration tests ผ่าน
- [ ] E2E ผ่านบน staging
- [ ] security regression suite ผ่าน
- [ ] migration deploy ผ่านบนสำเนา production
- [ ] backup restore drill ผ่าน
- [ ] load test ถึง target ที่ตกลง
- [ ] observability/alerts ทดสอบแล้ว
- [ ] rollback rehearsal ผ่าน
- [ ] secrets ไม่อยู่ใน git/image/log
- [ ] ไม่มี demo account หรือ seed data ใน production
- [ ] runbook และ on-call contact พร้อม
- [ ] legal/privacy review ผ่าน (ถ้าเปิด public)

---

## Suggested Execution Order

1. **Foundation:** P0-01, P0-05, P0-09, P0-07
2. **Security:** P0-02, P0-03, P0-04, P0-10, P0-11
3. **Deploy:** P0-08, P0-14, P1-03, P1-04
4. **Operations:** P0-12, P0-13, P1-09
5. **Scale/quality:** P1-01, P1-02, P1-05, P1-06, P1-10
6. **Launch:** ทำ Launch Gates ทั้งหมด แล้วจึงเปิด production

> ห้ามเริ่ม P0-08 (deploy topology) ก่อน P0-01/P0-02 เพราะจะทำให้ต้องย้าย secret และ auth ซ้ำ

---

## Decisions ที่ต้องขอจากเจ้าของโปรเจกต์

- [ ] เลือกผู้ให้บริการ hosting/PostgreSQL/Redis (managed vs self-hosted)
- [ ] โดเมนและ subdomain สำหรับ web/API/socket
- [ ] เปิด public registration หรือ invite-only
- [ ] ต้องมี email verification/password reset หรือไม่
- [ ] นโยบาย data retention และการลบบัญชี
- [ ] RPO/RTO และงบประมาณ backup/HA
- [ ] target concurrent users และ SLA
- [ ] ใครเป็น on-call และช่องทาง incident
- [ ] ต้องรองรับหลาย API instance ตั้งแต่ launch หรือไม่

---

## Change Log

| วันที่ | การเปลี่ยนแปลง | ผู้แก้ |
|---|---|---|
| 2026-11-20 | สร้างแผนเริ่มต้นจากการตรวจ repo และ test baseline | Buffy |

---

## หมายเหตุ

- แผนนี้ยังไม่เลือก vendor เฉพาะเจาะจง เพื่อไม่ผูกสถาปัตยกรรมก่อนการตัดสินใจ
- ห้ามใช้ `docker-compose.yml` ปัจจุบันเป็น production manifest โดยตรง
- ห้ามใช้ `prisma db push` กับ production database
- ห้ามใช้ secret default จาก repo แม้จะรีบ launch

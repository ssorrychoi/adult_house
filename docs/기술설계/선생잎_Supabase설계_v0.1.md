# 선생잎 Supabase 설계

> 버전: v0.1  
> 작성일: 2026-08-24

## 접근 원칙

- 비회원은 공개 게시글·댓글과 채용정보를 읽는다.
- 로그인 회원은 회원 공개 글을 읽고 글·댓글·반응·저장을 사용한다.
- 교사 인증은 선택이며 인증 회원만 어린이집 후기를 작성한다.
- 인증 상태는 사용자가 직접 수정할 수 없는 `profiles.is_verified`에 저장한다.
- 인증 파일은 비공개 `teacher-verifications` 버킷의 사용자 ID 폴더에 저장한다.
- 모든 공개 스키마 테이블에 RLS를 적용하고 작업별 정책을 분리한다.

## 테이블

| 영역 | 테이블 | 역할 |
|---|---|---|
| 회원 | `profiles` | 익명 닉네임, 직군, 경력, 인증 배지 |
| 분류 | `categories` | 4개 영역과 하위 카테고리 |
| 커뮤니티 | `posts`, `comments` | 게시글과 답변 |
| 반응 | `reactions`, `bookmarks` | 위로·도움 반응과 저장 |
| 커리어 | `jobs`, `saved_jobs` | 채용정보와 관심 공고 |
| 인증 | `teacher_verification_requests` | 인증 방식, 비공개 파일 경로, 검토 상태 |
| 후기 | `workplace_reviews` | 인증 회원의 어린이집 후기와 검수 상태 |
| 운영 | `notifications`, `reports`, `blocks` | 알림, 신고, 차단 |

## 관계

```text
auth.users ──1:1── profiles ──1:N── posts ──1:N── comments
                         ├──── reactions / bookmarks
                         ├──── teacher_verification_requests
                         ├──── workplace_reviews
                         └──── notifications / reports / blocks
categories ──1:N── posts
jobs ──1:N── saved_jobs
```

## 인증 처리

1. 사용자가 비공개 Storage의 `{user_id}/` 경로에 파일을 올린다.
2. 인증 요청에 파일 경로와 인증 방식을 기록한다.
3. 관리자 서버가 자료를 검토한다.
4. 승인 시 요청 상태와 `profiles.is_verified`를 서비스 역할로 변경한다.
5. 보존기간이 끝난 원본은 Storage API로 삭제한다.

## 적용과 다음 작업

초기 스키마, 카테고리, 인덱스, RLS, Storage 정책은 `supabase/migrations/20260824000000_initial_schema.sql`에 있다. 프로젝트 생성 후 연결, 마이그레이션 적용, OAuth 설정, Next.js 데이터 연동, RLS 시나리오 테스트 순으로 진행한다.

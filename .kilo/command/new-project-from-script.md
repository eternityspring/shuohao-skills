---
description: Viết tiếp một dự án vừa dán kịch bản trong Studio (projects/<slug>) cho tới khi qua gate và có báo cáo/video
---

# Viết tiếp dự án từ kịch bản đã dán

Studio (`node preview/pipeline/studio.mjs`) đã chia kịch bản và tạo khung trong `projects/<slug>/`:
`script.md` (bản gốc người dùng dán), `split.json` (kết quả đọc), `outline.json` + `script.json` (**bản nháp**), `briefs.json`, `project.json`.

Bản nháp **chưa qua quality gate**. Nhiệm vụ của bạn: viết đủ 6 tầng theo đúng skill, không nới gate.

```bash
node preview/pipeline/project.mjs status projects/<slug>
node preview/pipeline/project.mjs brief  projects/<slug>   # split + briefs + thiếu gì
node preview/pipeline/project.mjs gates  projects/<slug>   # chạy lại sau mỗi tầng
```

## Nguồn sự thật

- **Cốt truyện, nhân vật, lời thoại phải bám `split.json` + `script.md`.** Không bịa thêm tuyến, không đổi tên người, không đổi quan hệ.
- `split.json` có: `meta` (tên, thể loại, số tập, giây/tập), `characters` (id + tên gốc + tên trong ngoặc), `scenes`, `beats`, `episodes[].beats` (line/action), `unknownSpeakers`.
- Thiếu thông tin (quan hệ, tuổi, động cơ) thì **hỏi người dùng một lần**, đừng tự đoán rồi viết 6 tập theo phỏng đoán.

## Thứ tự bắt buộc

1. **outline** — `outline.json` đang là khung (`adaptation.core` rỗng, `characters[].arc` rỗng, `beats` có thể sai episode).
   - Đọc `skills/novel-outline/SKILL.md` + `references/schema.md`.
   - Điền `adaptation` (keep/cut/merge/risks + ghi chú), `characters[].arc/tier/role`, `beats` (đặt đúng tập, có ít nhất một `major` không ở tập cuối, khoảng cách ≤ 3), `episodes[]` (synopsis/hook/suspense/sceneIds/characterIds/crowdPlan/warnings).
   - `validate --stage beats` rồi `validate` (full) phải qua trước khi sang bước 2.
2. **cast** — đọc `novel-characters/SKILL.md`; `validate <cast.json> <script.md>` (evidence phải là câu **có thật trong `script.md`**).
3. **art** — đọc `novel-art/SKILL.md`; nhớ `dynasty` là một niên đại cụ thể; `validate --cast`.
4. **script** — `script.json` nháp chỉ có 1 cảnh/tập, thiếu hook/cliff và thiếu thời lượng.
   - Đọc `novel-script/SKILL.md` + `references/script-pass.md` + `references/schema.md`.
   - Giữ nguyên lời thoại gốc khi người dùng đã viết; viết thêm beat để đủ thời lượng (cộng không khí/chuyển ý, không đổi kết).
   - `validate --outline --art` phải qua.
5. **staging** — `novel-staging/SKILL.md`; `locations[].items` phải lấy từ cảnh art, không bịa đồ vật.
6. **storyboard** — `novel-storyboard/SKILL.md` + `references/storyboard-pass.md`, `h3-prompt.md`, `shot-writing.md`.
   - Mỗi beat = một `beats` được nhận đúng một lần; 2–5s/cut; ≤15s/đoạn; không đổi cảnh trong đoạn.
   - `h3Prompt` theo `promptLang` (mặc định `en`), tên nhân vật **không** được xuất hiện ngoài `<d>`.
   - `validate` với `--script --outline --cast --art` phải qua.

Sau mỗi tầng: `render` để có báo cáo, rồi `gates` để chắc tầng trước không vỡ.

## Kết thúc

```bash
node preview/pipeline/project.mjs gates   projects/<slug>
node preview/pipeline/project.mjs render  projects/<slug>
node preview/pipeline/project.mjs packs   projects/<slug>
node preview/pipeline/project.mjs video   projects/<slug>
```

Ảnh (nếu người dùng đồng ý): `character-refs config --show` trước; chưa cấu hình hoặc key hỏng thì **báo rõ**, không giả vờ đã sinh. Ảnh vào `images/<slug>-sheet.png`, keyframe vào `frames/<đoạn>/fN.png`.

Cập nhật `project.json` (`origin: web-paste`, `stages`) bằng `gates` là đủ; đừng sửa tay số liệu.
Báo cáo lại: tầng nào qua gate, thiếu gì, đường dẫn `report.html` và video, phần nào chưa verify.

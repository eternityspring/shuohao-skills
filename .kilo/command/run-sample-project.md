---
description: Dựng một dự án phim ngắn hoàn chỉnh từ kịch bản bằng shuohao-skills (bootstrap → 6 skill → ảnh → pack → video)
---

# Chạy một dự án phim ngắn từ kịch bản

Bạn đang ở repo `shuohao-skills`. Mục tiêu: từ kịch bản người dùng đưa, ra được một project cùng cấu trúc với mẫu `渡口` và một file video.

## 0. Chuẩn bị

- Node ≥ 18, ffmpeg có `libx264` + `aac` (kiểm tra: `ffmpeg -version`).
- Không cần API key cho 6 skill. Chỉ bước **ảnh** cần một image model (`character-refs config`).

## 1. Dựng khung

Nếu người dùng chỉ có kịch bản dạng chữ (md/txt), hoặc đã có JSON theo schema `novel-script`:

```bash
node preview/pipeline/project.mjs new --name <slug> --script <đường-dẫn>
```

Nếu người dùng muốn xem lại toàn bộ dự án mẫu (không cần model):

```bash
node preview/pipeline/project.mjs sample --name mau-dukou --force
```

Sau đó đọc đầu vào đã chuẩn hóa:

```bash
node preview/pipeline/project.mjs brief projects/<slug>
```

`brief` trả về: `params` (số tập, phút/tập, thể loại), `episodes`, `briefs` (flow/action/line theo từng cảnh), và `userScript` (kịch bản gốc nếu có). **Đây là đầu vào duy nhất được phép dùng** — không tự bịa lại hành động hay lời thoại khác với briefs.

## 2. Viết nội dung theo đúng thứ tự

Mỗi bước: đọc `skills/<skill>/SKILL.md`, viết file, chạy `validate` cho tới khi qua, rồi `render`. Thất bại của gate là phải sửa nội dung, không được nới gate.

| Bước | Skill | File ra | Lệnh kiểm |
| --- | --- | --- | --- |
| 1 | novel-outline | `outline.json` | `node skills/novel-outline/scripts/novel-outline.mjs validate projects/<slug>/outline.json` |
| 2 | novel-characters | `cast.json` | `validate projects/<slug>/cast.json projects/<slug>/book.txt` |
| 3 | novel-art | `art.json` | `validate projects/<slug>/art.json --cast projects/<slug>/cast.json` |
| 4 | novel-script | `script.json` | `validate projects/<slug>/script.json --outline ... --art ...` |
| 5 | novel-staging | `staging.json` | `validate projects/<slug>/staging.json --script ... --art ...` |
| 6 | novel-storyboard | `storyboard.json` | `validate projects/<slug>/storyboard.json --script ... --outline ... --cast ... --art ...` |

Quy tắc:

- `novel-outline` có `seed`/`chunk`: dùng khi có `book.txt` (tiểu thuyết). Có `briefs` thì viết thẳng `episodes[]` từ briefs — `outline.episodes[i].synopsis` phải khớp flow của tập đó.
- Số tập, số phút/tập, thể loại lấy từ `brief` / câu trả lời của người dùng — **không tự đoán**.
- Output nội dung là tiếng Trung (skill là Chinese-first). Không dịch lại; chỉ báo cáo UI mới có `--lang zh|en`.
- `storyboard` chỉ được dùng `beats` trỏ tới dòng trong `script.flow`; mọi câu thoại trong flow **phải** có cut nhận (`beats`), nếu không video sẽ mất lời.

## 3. Ảnh (khi người dùng đồng ý và đã cấu hình model)

```bash
node skills/character-refs/scripts/character-refs.mjs config --show
```

- Chưa có model → dừng, hỏi người dùng chọn `qwen` (ComfyUI) / `codex` / `openai` / `custom`.
- Ảnh nhân vật/sence/prop: đặt vào `projects/<slug>/images/<slug>-sheet.png` theo `skills/novel-characters/SKILL.md` và `skills/novel-art/SKILL.md`.
- Ảnh keyframe: `projects/<slug>/frames/<段号>/f<切序>.png` theo `skills/novel-storyboard/references/frame.md` (f1 = 主分镜图, mỗi ảnh dùng setting sheet làm tham chiếu).
- Không có model thì bỏ qua bước này, nói rõ video sẽ là placeholder.

## 4. Đóng gói và xuất video

```bash
node skills/novel-storyboard/scripts/novel-storyboard.mjs export \
  projects/<slug>/storyboard.json --script projects/<slug>/script.json \
  --frames projects/<slug>/frames --images projects/<slug>/images \
  --protocol h3 --out projects/<slug>/packs

node preview/pipeline/project.mjs render projects/<slug>
node preview/pipeline/project.mjs video projects/<slug>
```

- `render` xuất `<stage>-report.html`, `<stage>.md` và `report.html` gộp 5 báo cáo.
- `video` ghép `video/<tên>-full.mp4`; cut có ảnh thật thì pan/zoom ảnh, thiếu thì card chữ.
- Giọng đọc: đặt wav vào `voice/<段号>-<số-cắt>.wav` (mỗi cắt một file, do TTS bên ngoài sinh) rồi chạy `video ... --narration`. Không có wav thì track im lặng, video vẫn hợp lệ.
- Video thật (chuyển động do model sinh) **không** nằm trong repo: đưa `packs/<段号>/` cho MiniMax H3 hoặc Seedance, rồi ghép clip trả về theo `packs/manifest.json`.

## 5. Báo cáo lại

Nêu: slug project, số tập, những stage đã qua gate, số cut có ảnh thật / còn placeholder, đường dẫn `report.html` và file video. Nói rõ phần nào chưa verify (ảnh, video thật, TTS) nếu chưa chạy.

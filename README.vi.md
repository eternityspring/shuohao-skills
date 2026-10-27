# Shuohao Skills — hướng dẫn tiếng Việt

Bộ công cụ hỗ trợ làm phim ngắn bằng AI, từ truyện gốc đến hồ sơ nhân vật, bối cảnh, kịch bản và phân cảnh. Mỗi skill hoạt động độc lập bằng Node.js; agent đảm nhiệm phần sáng tác, còn script kiểm tra dữ liệu và dựng báo cáo.

## Mở bản xem thử

Tại thư mục dự án:

```bash
node scripts/build-preview.mjs
node preview/pipeline/studio.mjs
```

Mở **http://127.0.0.1:8765/?lang=vi**. Trang chủ dẫn đến:

| Trang | Nội dung |
| --- | --- |
| `report.html` | Năm mục: dàn ý, nhân vật, mỹ thuật, kịch bản và phân cảnh |
| `staging.html` | Kéo thả vị trí nhân vật, chỉnh tư thế, hướng mặt và diễn viên quần chúng; xuất JSON |
| `character-refs.html` | Hồ sơ và ảnh tham chiếu nhân vật đã tạo tại máy này |

Trang ảnh tham chiếu chỉ được dựng khi có `preview/characters/阿禾/asset.json`. Lệnh dựng trang không gọi API hoặc tạo thêm ảnh. Ảnh và dữ liệu thử cục bộ nằm trong `preview/`, được loại khỏi Git.

## Đổi ngôn ngữ

Bộ chọn **Ngôn ngữ** ở đầu mỗi trang có **Tiếng Việt / English / 中文**. Mặc định là tiếng Việt; lựa chọn được lưu trên trình duyệt và áp dụng khi mở trang khác. Dùng `?lang=vi`, `?lang=en` hoặc `?lang=zh` để mở trực tiếp một ngôn ngữ.

Chuyển ngôn ngữ ngay trên trang, giữ tab báo cáo và các chỉnh sửa bố trí. Nội dung cập nhật sau thao tác cũng được dịch. Hãy xuất JSON để lưu phương án bố trí trước khi đóng trang.

Bản dịch bao phủ giao diện và nội dung bộ mẫu Bến đò, cùng nhân vật A Hòa. Từ điển đã lưu tại `web/translations.json`; mở báo cáo không cần dịch vụ dịch hoặc API key. Cần chạy HTTP server cục bộ để trình duyệt tải từ điển.

Các nút xuất JSON ở cả năm mục báo cáo và công cụ bố trí xuất nội dung văn bản theo ngôn ngữ đang chọn, gồm tên, mô tả, lời thoại và prompt. Trường `lang` ghi ngôn ngữ xuất. ID, tên trường, đường dẫn, giá trị enum và tọa độ giữ nguyên; các tham chiếu bằng tên được dịch đồng nhất. File xuất là bản sao, không đổi dữ liệu làm việc; phần bố trí lấy cả các chỉnh sửa mới nhất. Một số quy tắc sản xuất gốc yêu cầu prompt tiếng Anh, nên cần chọn English khi xuất dữ liệu cho bước đó. Các nút sao chép prompt của báo cáo sản xuất vẫn dùng prompt gốc của công cụ; câu bố trí đang hiển thị được sao chép theo ngôn ngữ đang chọn. Tài liệu kỹ thuật và chú thích mã nguồn gốc vẫn được giữ. Nội dung mới ngoài bộ mẫu cần thêm bản dịch vào từ điển; bộ chọn không tự gọi AI để dịch văn bản mới.

## Bảy skill

| Skill | Công việc | Đầu ra chính |
| --- | --- | --- |
| `novel-outline` | Chuyển thể truyện thành dàn ý, danh sách nhân vật, điểm nhấn và nội dung từng tập | `outline.json` |
| `novel-characters` | Hồ sơ, ngoại hình, quan hệ và mô tả giọng nói của từng nhân vật | `cast.json` |
| `novel-art` | Thiết kế bối cảnh và đạo cụ, mốc nhận diện, biến thể và ánh sáng | `art.json` |
| `novel-script` | Viết cảnh, hành động, lời thoại và ước tính thời lượng | `script.json` |
| `novel-staging` | Bố trí ai có mặt, đứng hoặc ngồi ở đâu và nhìn hướng nào ở đầu cảnh | `staging.json` |
| `novel-storyboard` | Chia đoạn video, cú máy, khung hình và prompt sản xuất | `storyboard.json` |
| `character-refs` | Tạo ảnh chính diện làm ảnh gốc, sau đó tạo các góc tham chiếu | `asset.json` và ảnh PNG |

Thứ tự thông thường: **Dàn ý → Nhân vật / Mỹ thuật / Kịch bản → Bố trí đầu cảnh → Phân cảnh**. Ảnh tham chiếu hỗ trợ tính nhất quán nhân vật. Phần bố trí chưa tự nhập vào phân cảnh: cần đưa câu bố trí đã duyệt cho agent để dùng ở đoạn đầu của cảnh tương ứng.

Ví dụ yêu cầu agent: “Dùng novel-outline chuyển thể truyện này thành phim ngắn. Viết phần nội dung cho người đọc bằng tiếng Việt, giữ ID và tên trường theo schema.” Các mô tả cho mô hình ảnh hoặc video cần tuân thủ yêu cầu riêng của từng skill, thường là tiếng Anh.

Hướng dẫn chi tiết nằm trong từng thư mục `skills/<tên-skill>/`; bản tiếng Anh là `README.en.md`. Bộ chọn ngôn ngữ hiện áp dụng cho các trang được dựng bằng `scripts/build-preview.mjs`; lệnh `render` độc lập của từng skill giữ cách chọn ngôn ngữ ban đầu.

## Tạo ảnh qua 9router

Kết nối cục bộ đã dùng: `http://127.0.0.1:20128/v1`, adapter `openai`, model `cx/gpt-image-2`. Key chỉ truyền từ môi trường cho tiến trình Node, không đưa vào HTML hoặc từ điển:

```bash
OPENAI_API_KEY="$NINE_ROUTER_API_KEY" \
OPENAI_BASE_URL=http://127.0.0.1:20128/v1 \
node skills/character-refs/scripts/character-refs.mjs gen <asset.json> --tier 1
```

Lệnh này tạo ảnh thật. Sau khi ảnh gốc đạt yêu cầu, xác nhận trước khi tạo các góc tiếp theo. Cấu hình riêng máy nằm trong `skills/character-refs/config.local.json`, đã được loại khỏi Git.

## Sửa bản dịch và kiểm tra

Mỗi dòng trong `web/translations.json` gồm `id`, `source`, `vi`, `en`, `zh`. Sửa bản dịch rồi chạy lại `node scripts/build-preview.mjs` và tải lại trang. Mã chuyển ngôn ngữ nằm ở `web/language.js`; giao diện bộ chọn ở `web/language.css`.

```bash
node skills/novel-staging/scripts/selftest.mjs
node scripts/json-export-selftest.cjs
```

Kiểm tra trình duyệt cần Playwright và Chromium có sẵn; không được gọi mô hình hoặc dịch vụ ảnh:

```bash
SHUOHAO_PLAYWRIGHT_MODULE=/path/to/playwright \
SHUOHAO_CHROMIUM=/path/to/chromium \
node scripts/preview-i18n-test.cjs
```

Server xem thử phải đang chạy. Có thể đổi địa chỉ bằng `SHUOHAO_PREVIEW_URL`; ảnh chụp và kết quả được lưu ở thư mục tạm in ra sau kiểm tra.

Kiểm tra tải JSON thật từ cả 6 nút xuất ở ba ngôn ngữ:

```bash
SHUOHAO_PLAYWRIGHT_MODULE=/path/to/playwright \
SHUOHAO_CHROMIUM=/path/to/chromium \
node scripts/preview-json-export-test.cjs
```

Giao diện Studio nằm trong `web/studio.html`; chạy lại `node scripts/build-preview.mjs` sau khi sửa để cập nhật bản phục vụ. Trang chủ giữ lối vào báo cáo 5 mục, kèm ảnh xem trước; `#/projects` mở danh sách dự án.


## AI tự biên soạn trong Studio

Chạy `node preview/pipeline/studio.mjs`, mở `http://127.0.0.1:8765/#/new`, dán cốt truyện hoặc tải kịch bản. Nhập số tập, giây mỗi tập và thể loại, chọn model rồi bấm **AI biên soạn đầy đủ**. Không cần có sẵn định dạng `C01` hoặc tiêu đề `Tập N` để AI đọc câu chuyện.

AI gọi 9router theo thứ tự dàn ý → nhân vật → mỹ thuật → kịch bản từng tập → bố trí → phân cảnh từng tập. Mỗi phần phải qua bộ kiểm tra của skill trước khi dùng cho phần sau. Lỗi cấu trúc/nội dung được đưa lại cho model sửa tối đa hai lượt; lỗi kết nối hoặc lỗi còn lại hiện rõ trong dự án. Nút **Chạy tiếp từ phần đã lưu** bỏ qua các phần đã hợp lệ; **Dừng biên soạn** giữ lại kết quả đã lưu.

Cấu hình trên server qua biến môi trường hoặc file `.env.local` (được Git bỏ qua):

```dotenv
SHUOHAO_AI_BASE_URL=http://127.0.0.1:20128/v1
SHUOHAO_AI_MODEL=cx/gpt-6.1-sol
# NINE_ROUTER_API_KEY=<khóa của bạn>
```

Khóa được đọc từ `SHUOHAO_AI_API_KEY`, `NINE_ROUTER_API_KEY` hoặc `OPENAI_API_KEY`; không có trường nhập khóa trên trình duyệt. Chỉ cung cấp kịch bản cho 9router/model mà bạn chọn. Danh sách model Codex/Claude lấy từ `/v1/models`; việc biên soạn sử dụng `/v1/chat/completions`.

Dữ liệu gốc được giữ trong `kichban.md`, các phần trong `<stage>.json`, tiến độ trong `.ai/job.json`. Đây là hồ sơ sản xuất có nội dung do AI viết; chất lượng sáng tác vẫn cần bạn duyệt. Chưa có ảnh bối cảnh thì bố trí được đánh dấu suy từ mô tả. AI biên kịch chưa tự sinh ảnh, giọng nói hay video.

Kiểm tra cục bộ: `node scripts/ai-project-selftest.mjs`.

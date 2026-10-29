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

Các nút xuất JSON ở cả năm mục báo cáo và công cụ bố trí xuất nội dung văn bản theo ngôn ngữ đang chọn, gồm tên và mô tả. Prompt sản xuất luôn giữ tiếng Anh; lời thoại theo lựa chọn ngôn ngữ sản xuất và phụ đề giữ nguyên kịch bản gốc. Trường `lang` ghi ngôn ngữ xuất. ID, tên trường, đường dẫn, giá trị enum và tọa độ giữ nguyên; các tham chiếu bằng tên được dịch đồng nhất. File xuất là bản sao, không đổi dữ liệu làm việc; phần bố trí lấy cả các chỉnh sửa mới nhất. Ngôn ngữ giao diện không dịch lại prompt, thoại hoặc phụ đề. Các nút sao chép prompt của báo cáo sản xuất vẫn dùng prompt gốc của công cụ; câu bố trí đang hiển thị được sao chép theo ngôn ngữ đang chọn. Tài liệu kỹ thuật và chú thích mã nguồn gốc vẫn được giữ. Nội dung mới ngoài bộ mẫu cần thêm bản dịch vào từ điển; bộ chọn không tự gọi AI để dịch văn bản mới.

## Xuất JSON theo phần hoặc toàn bộ

Trong trang dự án và trang báo cáo, **Xuất JSON phần này** tải riêng phần đang xem; **Xuất toàn bộ JSON** gộp sáu phần, kết quả đọc hiểu, hồ sơ đạo diễn, dữ liệu tách kịch bản, thông tin dự án và kịch bản gốc vào một file. Phần chưa có dữ liệu mang giá trị `null`. File tổng hợp giữ từng tài liệu đầy đủ dưới các khóa `outline`, `cast`, `art`, `script`, `staging`, `storyboard`, `reading`, `production`, `split`; không chỉ lấy phần tóm tắt trong hồ sơ đạo diễn. Dữ liệu được đọc lại khi bấm xuất. Nút xuất riêng trong báo cáo bố trí giữ cả các chỉnh sửa chưa lưu; xuất toàn bộ lấy dữ liệu đã lưu của dự án.

Tên file gồm mã dự án, tên phần và ngôn ngữ, ví dụ `THE-QUIRKY-KINGDOM-dan-y-vi.json`, `THE-QUIRKY-KINGDOM-phan-canh-vi.json`, `THE-QUIRKY-KINGDOM-toan-bo-vi.json`. Tên được giới hạn độ dài để không mất phần phân biệt khi tải xuống. Nội dung và trường `lang` của các tài liệu lồng nhau theo ngôn ngữ hiện tại; ID và giá trị kỹ thuật giữ nguyên. Chức năng xuất không gọi AI và không thay đổi dữ liệu làm việc.

## Thoại tiếng Anh và phụ đề gốc

Ở bước tạo dự án, **Ngôn ngữ thoại** cho phép giữ ngôn ngữ gốc hoặc chọn **Tiếng Anh + phụ đề gốc**. Khi chọn tiếng Anh, một lần chạy biên soạn đủ sáu phần rồi tự dịch và kiểm tra bản tiếng Anh. Prompt ảnh, bảng thiết kế, giọng nói, chuyển động, H3, visualDNA và styleDNA luôn bằng tiếng Anh; đổi ngôn ngữ giao diện hoặc xuất JSON không dịch lại chúng.

Dự án đã hoàn tất có nút **Chuyển toàn bộ sang tiếng Anh** ở trang dữ liệu và báo cáo. Tiến trình dịch qua 9router, lưu từng đợt, tự chờ dịch vụ phục hồi, có thể Dừng rồi chạy tiếp từ cache. Chỉ kích hoạt bản tiếng Anh sau khi kiểm tra đủ sáu phần và dựng báo cáo thành công. Bản gốc và các snapshot đã duyệt được giữ nguyên; **Xem bản gốc** chuyển lại dữ liệu gốc. Bản tiếng Anh nằm trong `projects/<slug>/editions/en-<fingerprint>/`.

Trong bản tiếng Anh, `line` dùng cho giọng đọc và H3 `<d>`, `originalLine` và `subtitle` giữ nguyên câu trong kịch bản đã biên soạn; `dialogueLang: "en"` và `subtitleLang` ghi rõ hai ngôn ngữ. Phụ đề hiển thị ngay dưới thoại trong báo cáo kịch bản, phân cảnh và hồ sơ đạo diễn. Có nút tải `subtitles-original.srt` và `subtitles-bilingual.srt` (câu tiếng Anh trên, câu gốc dưới), cùng `subtitles.json` trong file xuất tổng hợp. Thời điểm phụ đề tính theo shot và lượng thoại, là mốc dự kiến trước khi có âm thanh thật. Chưa tự tạo giọng đọc hoặc đốt phụ đề vào video ở bước dịch này.

Bản dịch giữ ID, thứ tự cảnh/beat/cut, số giây, trạng thái nối shot, tên riêng, bằng chứng nguồn và enum kỹ thuật. Câu tiếng Anh phải vừa ngân sách shot; bản dịch quá dài hoặc thiếu nghĩa cần sửa trước khi kích hoạt. Kiểm tra bằng `node scripts/production-language-selftest.mjs` và `node scripts/studio-brain-integration-selftest.mjs` (AI giả lập, validator/render thật).

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

Trong Studio, các thẻ **Nhân vật**, **Mỹ thuật**, **Bố trí** và **Phân cảnh** có nút tạo ảnh ngay tại từng mục. Có thể tạo ảnh nhân vật, bối cảnh, đạo cụ, biến thể ánh sáng/trạng thái và keyframe; các báo cáo tương ứng cũng có bảng ảnh tham chiếu. Nút **Tạo lại ảnh** giữ các phiên bản cũ, **Tải ảnh PNG** tải ảnh đang dùng. Tiến trình chạy nền, hỗ trợ dừng và vẫn tiếp tục khi đổi trang.

Ảnh được gọi qua 9router bằng khóa ở server, dùng prompt tiếng Anh đã lưu. Model mặc định là `cx/gpt-image-2`; có thể đặt `SHUOHAO_IMAGE_MODEL`, `SHUOHAO_IMAGE_QUALITY` và `SHUOHAO_IMAGE_TIMEOUT_MS` trong `.env.local` (timeout `0` là chờ tới khi có phản hồi hoặc chủ động dừng). Danh sách `/v1/models` của router có thể không liệt kê model ảnh.

Keyframe chỉ được tạo sau khi đủ ảnh nhân vật, bối cảnh và đạo cụ liên quan; các ảnh này được gửi thật dưới dạng data URL trong `images[]` qua `/v1/images/generations` khi dùng Codex (`cx/`). Adapter Images chuẩn dùng multipart `image[]` qua `/v1/images/edits`; có thể ép chế độ bằng `SHUOHAO_IMAGE_REFERENCE_MODE=json|multipart`. Biến thể dùng ảnh gốc làm tham chiếu. Thay prompt hoặc tạo lại ảnh gốc sẽ đánh dấu ảnh phụ thuộc cần cập nhật. Tạo ảnh không tự tạo video hoặc xác nhận chất lượng hình ảnh.

Ảnh có phiên bản được lưu ở `images/references/`, sổ theo dõi tại `reference-images.json` (có trong xuất JSON tổng hợp). Ảnh hiện hành cũng được đặt vào `images/<tên>-sheet.png` và `frames/<đoạn>/f<cut>.png` để báo cáo và bộ xuất pack/video dùng được. Dữ liệu kịch bản và các snapshot đã duyệt được giữ nguyên.

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

Chạy `node preview/pipeline/studio.mjs`, mở `http://127.0.0.1:8765/#/new`, dán cốt truyện hoặc tải kịch bản. Số tập, giây mỗi tập và thể loại là gợi ý tùy chọn: có thể để trống để AI tự đọc và quyết định. AI ưu tiên giữ đủ cốt truyện, diễn xuất, hình ảnh, phản ứng và tính liên tục, tự chia số tập/cảnh phù hợp; có thể vượt mọi ước tính đã nhập. Thời lượng được tính sau khi viết nội dung và lập shot, không ép theo ngân sách ±15%. Các giới hạn kỹ thuật từng shot/đoạn vẫn được giữ. Chọn model rồi bấm **AI biên soạn đầy đủ**. Không cần có sẵn định dạng `C01` hoặc tiêu đề `Tập N` để AI đọc câu chuyện.

AI gọi 9router theo thứ tự dàn ý → nhân vật → mỹ thuật → kịch bản từng tập → bố trí → phân cảnh từng tập. Mỗi phần phải qua bộ kiểm tra của skill trước khi dùng cho phần sau. Lỗi cấu trúc/nội dung được đưa lại cho model sửa tối đa hai lượt; một lần nhấn chạy liên tiếp từ đọc hiểu đến đủ sáu phần và báo cáo. Model có thể xử lý lâu: mặc định không giới hạn thời gian chờ phản hồi, kể cả trước khi server gửi header. Lỗi tạm thời được thử lại nhanh tối đa 3 lần với thời gian chờ tăng dần. Nếu mạng hoặc dịch vụ vẫn chưa sẵn sàng (HTTP 408/425/429/502/503/504/522/524), mặc định hệ thống tiếp tục chờ và tự thử lại mỗi 60 giây; không yêu cầu bấm chạy tiếp. Giữ nguyên thứ tự cảnh và các đoạn đã duyệt, hiển thị trạng thái chờ cùng thời điểm thử lại; không ghi log lỗi cuối cùng khi đang chờ. HTTP 400/401/403, phản hồi sai cấu trúc kéo dài và HTTP 500 không được chờ vô hạn. Trang từng hiển thị lỗi vẫn cập nhật trạng thái nếu lượt chạy được tiếp tục ở tab khác. Chỉ khi thật sự không thể tiếp tục, dự án mới hiện lỗi và lưu chi tiết có tên bước vào `.ai/errors.jsonl`. Nút Dừng hủy cả lúc đang chờ hoặc chờ thử lại. Nút **Chạy tiếp từ phần đã lưu** bỏ qua các phần đã hợp lệ; **Dừng biên soạn** giữ lại kết quả đã lưu.

Phân cảnh chi tiết được viết **tuần tự theo mạch phim**, kể cả khi đổi cảnh. Mỗi lượt nhận kịch bản cả tập, kế hoạch phân cảnh chung, đoạn trước đã duyệt (diễn xuất, âm thanh, trạng thái kết thúc) và cảnh kế tiếp. Trong cùng cảnh, trạng thái đầu shot phải khớp trạng thái cuối shot trước. Khi đổi cảnh, AI phải viết `production.sceneLink` ở cut đầu: tham chiếu đúng đoạn/trạng thái đã duyệt và giải thích mối nối hành động, cảm xúc. Vị trí mở cảnh vẫn theo bố trí của địa điểm mới. Hệ thống kiểm tra các tham chiếu và trạng thái này trước khi lưu, đồng thời vẫn kiểm tra kiểu nối sang cảnh kế. Cảnh cũ thiếu mối nối được dùng làm bản nháp để AI bổ sung; bản trước khi sửa được giữ trong `.ai/before/scene-links/`. Không bật viết nhiều cảnh độc lập bằng cấu hình số luồng. Giao diện hiển thị số đoạn đã kiểm tra và đoạn đang viết. Đây là kiểm tra kỹ thuật và ngữ cảnh đầu vào; chất lượng kể chuyện của lời giải thích vẫn cần người làm phim duyệt.

Cấu hình trên server qua biến môi trường hoặc file `.env.local` (được Git bỏ qua):

```dotenv
SHUOHAO_AI_BASE_URL=http://127.0.0.1:20128/v1
SHUOHAO_AI_MODEL=cx/gpt-6.1-sol
# 0 = không giới hạn; có thể đặt số mili giây
SHUOHAO_AI_TIMEOUT_MS=0
SHUOHAO_AI_MAX_RETRIES=3
SHUOHAO_AI_RETRY_DELAY_MS=3000
# 0 = chờ dịch vụ phục hồi không giới hạn; -1 = chỉ thử nhanh; số dương = giới hạn mili giây
SHUOHAO_AI_AVAILABILITY_WAIT_MS=0
SHUOHAO_AI_AVAILABILITY_RETRY_MS=60000
# NINE_ROUTER_API_KEY=<khóa của bạn>
```

Khóa được đọc từ `SHUOHAO_AI_API_KEY`, `NINE_ROUTER_API_KEY` hoặc `OPENAI_API_KEY`; không có trường nhập khóa trên trình duyệt. Chỉ cung cấp kịch bản cho 9router/model mà bạn chọn. Danh sách model Codex/Claude lấy từ `/v1/models`; việc biên soạn sử dụng `/v1/chat/completions`.

Dữ liệu gốc được giữ trong `kichban.md`, các phần trong `<stage>.json`, tiến độ trong `.ai/job.json`. Đây là hồ sơ sản xuất có nội dung do AI viết; chất lượng sáng tác vẫn cần bạn duyệt. Chưa có ảnh bối cảnh thì bố trí được đánh dấu suy từ mô tả. AI biên kịch chưa tự sinh ảnh, giọng nói hay video.

Kiểm tra mạch phim, nối cảnh và cache: `node scripts/production-storyboard-selftest.mjs`. Kiểm tra cục bộ: `node scripts/ai-project-selftest.mjs` và `node scripts/ai-transport-selftest.mjs` (server AI giả lập). Để xác minh chờ quá 5 phút: `SHUOHAO_TEST_LONG_WAIT_MS=305000 node scripts/ai-transport-selftest.mjs`. Khi Studio đang chạy và máy có Google Chrome: `node scripts/studio-ai-browser-selftest.mjs` kiểm tra một lần nhấn, trạng thái chờ/thử lại, kết nối lại, log lỗi và Dừng; toàn bộ API được chặn bằng phản hồi giả lập.

### Bộ não đạo diễn và hồ sơ sản xuất

Các lượt **AI biên soạn đầy đủ** mới sử dụng `skills/brain_studio.md` cùng hợp đồng ở `scripts/references/studio-production.md`. Luồng xử lý:

1. Đọc toàn bộ kịch bản thành `reading.json`: dữ kiện kèm trích dẫn nguyên văn, kết thúc, điểm chưa rõ, đề xuất bổ sung và định hướng cơ học/máy quay/ánh sáng theo thể loại. Bước đọc cấu trúc không AI vẫn hoạt động riêng.
2. Dùng cùng bản đọc hiểu cho cả sáu phân xưởng. Khóa DNA ngoại hình, trọng tâm, dáng đi, biểu cảm bốn vùng, giọng nói; thiết kế vật liệu và tỷ lệ đạo cụ; gắn cử chỉ và diễn ngầm vào thoại; khóa trục máy và hướng sáng.
3. Lập phân cảnh trước, sau đó viết thẻ kỹ thuật tám mục theo từng đoạn tối đa 15 giây. Shot dài 3–5 giây (khoảng chung giữa tài liệu và chuẩn H3). Timeline phải phủ đúng thời lượng; trạng thái nhân vật/đạo cụ ở cuối shot trước phải khớp đầu shot sau trong cùng cảnh. Đổi cảnh được đặt chuyển cảnh riêng.
4. Dựng **Hồ sơ đạo diễn** (`production-report.html`) và `production.json`, mở ngay trong Studio. Thẻ shot có thời gian đầu/cuối, máy quay, không gian, diễn hoạt, biểu cảm, người nghe, âm thanh/thoại, nối shot và prompt tiếng Anh. Các báo cáo từng skill vẫn được giữ.

Bản bộ não dùng cho một lượt được lưu cố định trong `.ai/brain.json`; chạy tiếp dùng đúng bản này và bỏ qua các đoạn đã hợp lệ. Dự án mới lưu chế độ `content-first`; `project.json` và tiến độ lưu riêng ước tính ban đầu, số tập đã chọn, thời lượng kịch bản và thời lượng phân cảnh. Lượt cũ giữ hợp đồng cũ; tạo dự án mới để dùng đầy đủ bộ não. Không tự sửa hồ sơ đang được AI xử lý: thay đổi ngoài luồng ở phần đã duyệt sẽ được báo để tránh ghi đè.

Các kiểm tra tự động phát hiện sai cấu trúc, trích dẫn không tồn tại, thiếu diễn xuất/người nghe, sai DNA, thời gian và nối trạng thái. Chúng không chứng minh chất lượng nghệ thuật hay độ liên tục của video thật; đạo diễn vẫn cần duyệt nội dung và các tài sản sau khi sinh.

```bash
node scripts/studio-brain-selftest.mjs
node scripts/ai-project-selftest.mjs
node scripts/studio-brain-integration-selftest.mjs
```

Kiểm tra tích hợp dùng phản hồi AI giả lập, nhưng chạy các validator và bộ render thật. Kiểm tra trình duyệt: `SHUOHAO_PLAYWRIGHT_MODULE=/path/to/playwright SHUOHAO_CHROMIUM=/path/to/chromium node scripts/studio-brain-browser-selftest.cjs`.

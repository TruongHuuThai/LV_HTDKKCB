import json
import random
from pathlib import Path

OUTPUT_PATH = Path("eval_questions_master_250.jsonl")
SEED = 20260422

TARGET_COUNTS = {
    "fact_1hop": 100,
    "multi_hop": 75,
    "comparison_condition": 38,
    "keyword_noise": 25,
    "out_of_scope": 12,
}

DIFFICULTY_WEIGHTS = {
    "fact_1hop": ("easy", "medium", "hard"),
    "multi_hop": ("medium", "hard", "hard"),
    "comparison_condition": ("medium", "hard", "hard"),
    "keyword_noise": ("medium", "hard", "hard"),
    "out_of_scope": ("easy", "medium", "medium"),
}

OPENERS = [
    "Cho mình hỏi",
    "Cho tôi hỏi",
    "Mình cần biết",
    "Tư vấn giúp mình",
    "Cho hỏi nhanh",
    "Xác nhận giúp",
]

QUESTION_STYLES = [
    "{opener} {body}?",
    "{body} đúng không?",
    "{opener}, {body} được không?",
    "{body} là như thế nào?",
]

NOISE_PREFIX = [
    "[gấp]",
    "[urgent]",
    "xin hỏi gấp:",
    "tôi ghi nhanh:",
    "faq check:",
]

OOS_QUESTIONS = [
    "Phòng khám có làm việc thứ Bảy, Chủ nhật không",
    "Địa chỉ cụ thể của phòng khám là gì",
    "Số hotline đặt lịch là bao nhiêu",
    "Có nhận thanh toán tiền mặt tại quầy không",
    "Có hỗ trợ thẻ tín dụng quốc tế không",
    "Bác sĩ nào trực khung giờ 15:00 hôm nay",
    "Chi phí khám tổng quát hiện tại là bao nhiêu",
    "Có được khám ngoài giờ sau 18:00 không",
    "Phòng khám có gửi xe miễn phí không",
    "Có hỗ trợ đặt lịch qua Zalo OA không",
    "Thời gian trả kết quả xét nghiệm là bao lâu",
    "Có chương trình ưu đãi cho sinh viên không",
    "Cần CCCD bản gốc hay bản photo công chứng",
    "Phụ nữ mang thai có được ưu tiên xếp hàng không",
    "Có cần xếp lịch riêng cho người cao tuổi không",
]


def choose_difficulty(q_type: str) -> str:
    return random.choice(DIFFICULTY_WEIGHTS[q_type])


def stylize(body: str) -> str:
    style = random.choice(QUESTION_STYLES)
    opener = random.choice(OPENERS)
    text = style.format(opener=opener.lower(), body=body)
    text = text[0].upper() + text[1:]
    return text


def add_unique(rows, seen_questions, row):
    q = row["question"].strip().lower()
    if q in seen_questions:
        return False
    seen_questions.add(q)
    rows.append(row)
    return True


def make_fact_1hop_rows(rows, seen):
    qid = len(rows) + 1

    morning_syn = ["buổi sáng", "ca sáng"]
    afternoon_syn = ["buổi chiều", "ca chiều"]

    while sum(1 for r in rows if r["question_type"] == "fact_1hop") < TARGET_COUNTS["fact_1hop"]:
        doc = random.choice(["D01", "D02", "D03", "D04"])

        if doc == "D01":
            body = random.choice([
                f"khung giờ khám {random.choice(morning_syn)} là mấy giờ đến mấy giờ",
                f"khung giờ khám {random.choice(afternoon_syn)} là mấy giờ đến mấy giờ",
                "phòng khám hoạt động trong ngày theo khung giờ nào",
                "nên đến sớm bao nhiêu phút trước giờ khám để xác nhận thông tin",
                "tôi đến trước giờ hẹn 15 đến 20 phút có đúng khuyến nghị không",
            ])
            ans = "Phòng khám hoạt động 07:30-11:30 và 13:00-16:30; bệnh nhân nên đến sớm 15-20 phút để xác nhận thông tin."

        elif doc == "D02":
            body = random.choice([
                "có thể hủy lịch trước giờ khám tối thiểu bao lâu",
                "đổi lịch cần thực hiện trước giờ khám bao nhiêu phút",
                "qua mốc 1 giờ trước giờ khám thì hệ thống xử lý hủy đổi lịch ra sao",
                "nếu sát giờ khám thì có chắc chắn đổi lịch được không",
                "mốc thời gian tối thiểu để được phép hủy lịch là gì",
            ])
            ans = "Có thể hủy/đổi lịch nếu thực hiện trước giờ khám tối thiểu 1 giờ; qua mốc này hệ thống có thể từ chối thao tác."

        elif doc == "D03":
            body = random.choice([
                "hệ thống đang hỗ trợ hình thức thanh toán nào",
                "có hỗ trợ chuyển khoản QR Banking không",
                "thông tin thanh toán được gửi vào thời điểm nào",
                "sau khi tạo lịch thì nhận thông tin thanh toán như thế nào",
                "bệnh nhân có nhận thông tin thanh toán ngay sau tạo lịch không",
            ])
            ans = "Hệ thống hỗ trợ thanh toán chuyển khoản QR Banking; sau khi tạo lịch bệnh nhân sẽ nhận thông tin thanh toán để hoàn tất."

        else:
            body = random.choice([
                "sử dụng BHYT cần mang giấy tờ gì",
                "bảo hiểm tư nhân cần giấy tờ hợp lệ như thế nào",
                "quyền lợi bảo hiểm được xác định dựa trên yếu tố nào",
                "quyền lợi BHYT có cố định hay phụ thuộc hồ sơ tiếp nhận",
                "khi dùng bảo hiểm cần lưu ý điều kiện gì",
            ])
            ans = "Bệnh nhân cần mang giấy tờ hợp lệ; quyền lợi bảo hiểm phụ thuộc quy định đơn vị bảo hiểm và tình trạng hồ sơ tại thời điểm tiếp nhận."

        row = {
            "query_id": f"Q{qid:04d}",
            "question": stylize(body),
            "gold_answer": ans,
            "gold_doc_ids": [doc],
            "question_type": "fact_1hop",
            "difficulty": choose_difficulty("fact_1hop"),
            "must_not_hallucinate": True,
        }
        if add_unique(rows, seen, row):
            qid += 1


def make_multi_hop_rows(rows, seen):
    qid = len(rows) + 1

    combos = [
        ("D01", "D02", "Nếu muốn đổi lịch thì cần thực hiện trước giờ khám tối thiểu 1 giờ, và nên đến sớm 15-20 phút khi đi khám."),
        ("D01", "D03", "Phòng khám hoạt động 07:30-11:30 và 13:00-16:30; hệ thống hỗ trợ QR Banking và gửi thông tin thanh toán sau khi tạo lịch."),
        ("D01", "D04", "Cần đến sớm 15-20 phút để xác nhận thông tin và mang giấy tờ hợp lệ nếu dùng BHYT/bảo hiểm tư nhân."),
        ("D02", "D03", "Hủy/đổi lịch cần trước giờ khám tối thiểu 1 giờ; thanh toán hiện hỗ trợ QR Banking và thông tin được gửi sau khi tạo lịch."),
        ("D02", "D04", "Nếu cần hủy/đổi lịch phải trước giờ khám tối thiểu 1 giờ; quyền lợi bảo hiểm còn phụ thuộc quy định đơn vị bảo hiểm và hồ sơ tiếp nhận."),
        ("D03", "D04", "Hệ thống hỗ trợ QR Banking sau khi tạo lịch; khi dùng BHYT/bảo hiểm cần có giấy tờ hợp lệ và quyền lợi phụ thuộc quy định/hồ sơ."),
    ]

    bodies = [
        "vừa hỏi về lịch khám vừa hỏi về thanh toán thì thông tin tổng hợp là gì",
        "nếu tôi dùng bảo hiểm và đóng tiền QR Banking thì cần lưu ý gì",
        "tôi muốn đổi lịch và thanh toán ngay, quy định nào cần nhớ",
        "vui lòng tóm tắt giúp tôi các bước chuẩn bị trước khi đến khám",
        "nếu tôi đến khám theo giờ hẹn và muốn dùng bảo hiểm thì cần gì",
        "hãy ghép thông tin về khung giờ và chính sách hủy đổi lịch",
    ]

    while sum(1 for r in rows if r["question_type"] == "multi_hop") < TARGET_COUNTS["multi_hop"]:
        d1, d2, ans = random.choice(combos)
        body = random.choice(bodies)
        body = body + " " + random.choice([
            "xin trả lời ngắn gọn",
            "trả lời đầy đủ giúp mình",
            "cho mình bản tóm tắt",
            "cho mình check thông tin",
            "để mình xác nhận lại",
        ])

        row = {
            "query_id": f"Q{qid:04d}",
            "question": stylize(body),
            "gold_answer": ans,
            "gold_doc_ids": [d1, d2],
            "question_type": "multi_hop",
            "difficulty": choose_difficulty("multi_hop"),
            "must_not_hallucinate": True,
        }
        if add_unique(rows, seen, row):
            qid += 1


def make_comparison_condition_rows(rows, seen):
    qid = len(rows) + 1

    bodies_answers = [
        (
            "so sánh trường hợp hủy lịch trước 90 phút và trước 30 phút",
            "Trước 90 phút (>=1 giờ) có thể hủy/đổi; trước 30 phút (<1 giờ) hệ thống có thể từ chối thao tác.",
            ["D02"],
        ),
        (
            "nếu tôi đến sát giờ hẹn thay vì đến sớm 15-20 phút thì có đúng khuyến nghị không",
            "Không đúng khuyến nghị; bệnh nhân nên đến sớm 15-20 phút để xác nhận thông tin.",
            ["D01"],
        ),
        (
            "trường hợp có bảo hiểm nhưng không mang đủ giấy tờ thì quyền lợi xử lý thế nào",
            "Cần giấy tờ hợp lệ khi sử dụng BHYT/bảo hiểm; quyền lợi phụ thuộc quy định đơn vị bảo hiểm và tình trạng hồ sơ tiếp nhận.",
            ["D04"],
        ),
        (
            "nếu đã tạo lịch thì lúc nào nhận thông tin QR Banking",
            "Sau khi tạo lịch, bệnh nhân sẽ nhận thông tin thanh toán QR Banking để hoàn tất.",
            ["D03"],
        ),
        (
            "tôi muốn đổi lịch nhưng đã qua mốc 1 giờ trước giờ khám, so với trường hợp còn hơn 1 giờ thì khác gì",
            "Còn hơn 1 giờ trước giờ khám có thể hủy/đổi; qua mốc này hệ thống có thể từ chối.",
            ["D02"],
        ),
        (
            "so sánh quyền lợi bảo hiểm khi hồ sơ đầy đủ và khi hồ sơ chưa đầy đủ",
            "Quyền lợi phụ thuộc quy định đơn vị bảo hiểm và tình trạng hồ sơ tại thời điểm tiếp nhận.",
            ["D04"],
        ),
        (
            "nếu vừa cần đổi lịch vừa cần thanh toán thì nên ưu tiên bước nào để không vi phạm mốc thời gian",
            "Cần đảm bảo thao tác hủy/đổi trước giờ khám tối thiểu 1 giờ; thanh toán QR Banking được hỗ trợ và thông tin gửi sau khi tạo lịch.",
            ["D02", "D03"],
        ),
    ]

    while sum(1 for r in rows if r["question_type"] == "comparison_condition") < TARGET_COUNTS["comparison_condition"]:
        body, ans, doc_ids = random.choice(bodies_answers)
        row = {
            "query_id": f"Q{qid:04d}",
            "question": stylize(body),
            "gold_answer": ans,
            "gold_doc_ids": doc_ids,
            "question_type": "comparison_condition",
            "difficulty": choose_difficulty("comparison_condition"),
            "must_not_hallucinate": True,
        }
        if add_unique(rows, seen, row):
            qid += 1


def add_noise(text: str) -> str:
    noise_bits = [
        "giữ nguyên ý nghĩa nhé",
        "tôi gọi từ mobile",
        "có thể viết ngắn",
        "mình cần gấp",
        "xin trả lời chính xác",
    ]
    return f"{random.choice(NOISE_PREFIX)} {text} ({random.choice(noise_bits)})"


def make_keyword_noise_rows(rows, seen):
    qid = len(rows) + 1

    core = [
        ("giờ khám sáng chiều và đến sớm", "Phòng khám 07:30-11:30 và 13:00-16:30; nên đến sớm 15-20 phút.", ["D01"]),
        ("hủy đổi lịch trước 1 giờ", "Hủy/đổi lịch cần trước giờ khám tối thiểu 1 giờ; qua mốc này hệ thống có thể từ chối.", ["D02"]),
        ("QR Banking nhận thông tin sau tạo lịch", "Hệ thống hỗ trợ QR Banking; thông tin thanh toán gửi sau khi tạo lịch.", ["D03"]),
        ("BHYT bảo hiểm cần giấy tờ hợp lệ", "Cần mang giấy tờ hợp lệ; quyền lợi phụ thuộc quy định bảo hiểm và tình trạng hồ sơ.", ["D04"]),
        ("đổi lịch + QR Banking", "Đổi lịch cần trước 1 giờ; thanh toán hỗ trợ QR Banking và thông tin gửi sau tạo lịch.", ["D02", "D03"]),
    ]

    while sum(1 for r in rows if r["question_type"] == "keyword_noise") < TARGET_COUNTS["keyword_noise"]:
        body, ans, doc_ids = random.choice(core)
        noisy = add_noise(body)
        if random.random() < 0.5:
            noisy += " -- từ khóa: lịch,bảo hiểm,qr,giờ"

        row = {
            "query_id": f"Q{qid:04d}",
            "question": stylize(noisy),
            "gold_answer": ans,
            "gold_doc_ids": doc_ids,
            "question_type": "keyword_noise",
            "difficulty": choose_difficulty("keyword_noise"),
            "must_not_hallucinate": True,
        }
        if add_unique(rows, seen, row):
            qid += 1


def make_out_of_scope_rows(rows, seen):
    qid = len(rows) + 1

    while sum(1 for r in rows if r["question_type"] == "out_of_scope") < TARGET_COUNTS["out_of_scope"]:
        q = random.choice(OOS_QUESTIONS)
        ans = "Không tìm thấy thông tin này trong bộ tri thức hiện tại. Vui lòng liên hệ lễ tân/hỗ trợ để được cập nhật chính xác."

        row = {
            "query_id": f"Q{qid:04d}",
            "question": stylize(q),
            "gold_answer": ans,
            "gold_doc_ids": [],
            "question_type": "out_of_scope",
            "difficulty": choose_difficulty("out_of_scope"),
            "must_not_hallucinate": True,
        }
        if add_unique(rows, seen, row):
            qid += 1


def assign_query_ids(rows):
    for i, row in enumerate(rows, start=1):
        row["query_id"] = f"Q{i:04d}"


def validate(rows):
    assert len(rows) == 250, f"Expected 250 rows, got {len(rows)}"
    counts = {k: 0 for k in TARGET_COUNTS}
    for r in rows:
        counts[r["question_type"]] += 1
    for key, target in TARGET_COUNTS.items():
        assert counts[key] == target, f"{key}: expected {target}, got {counts[key]}"


def main():
    random.seed(SEED)
    rows = []
    seen = set()

    make_fact_1hop_rows(rows, seen)
    make_multi_hop_rows(rows, seen)
    make_comparison_condition_rows(rows, seen)
    make_keyword_noise_rows(rows, seen)
    make_out_of_scope_rows(rows, seen)

    random.shuffle(rows)
    assign_query_ids(rows)
    validate(rows)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

-- 创建演示分析数据
-- 模拟七年级期中考试成绩分析

-- 1. 创建整体分析结果
INSERT INTO biz_score_analysis (
    analysis_id, exam_id, exam_name, grade_level, 
    analysis_type, analysis_scope, 
    analysis_data,
    created_by, created_by_name,
    status
) VALUES (
    'ANALYSIS_20250224_001',
    1,
    '七年级期中教学调研',
    '7年级',
    'overall',
    'all',
    '{
        "summary": {
            "total_students": 320,
            "participated": 315,
            "absent": 5,
            "participation_rate": 98.44
        },
        "grade_statistics": {
            "total_score": {
                "mean": 385.6,
                "median": 392.0,
                "std": 68.5,
                "min": 185,
                "max": 495,
                "q1": 335,
                "q3": 438
            }
        },
        "distribution": {
            "excellent": 58,
            "good": 96,
            "pass": 128,
            "fail": 33
        },
        "ranking": {
            "top10": ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十", "郑十一", "陈十二"],
            "top10_scores": [495, 492, 488, 485, 482, 480, 478, 475, 473, 470]
        },
        "chart_data": {
            "score_distribution": [
                {"range": "450-500", "count": 58, "percentage": 18.4},
                {"range": "400-449", "count": 96, "percentage": 30.5},
                {"range": "350-399", "count": 78, "percentage": 24.8},
                {"range": "300-349", "count": 50, "percentage": 15.9},
                {"range": "250-299", "count": 23, "percentage": 7.3},
                {"range": "<250", "count": 10, "percentage": 3.2}
            ],
            "class_comparison": [
                {"class": "701班", "mean": 425.6, "layer": "A"},
                {"class": "702班", "mean": 418.3, "layer": "A"},
                {"class": "703班", "mean": 395.2, "layer": "B"},
                {"class": "704班", "mean": 388.7, "layer": "B"},
                {"class": "705班", "mean": 382.4, "layer": "B"},
                {"class": "706班", "mean": 358.6, "layer": "C"},
                {"class": "707班", "mean": 352.1, "layer": "C"},
                {"class": "708班", "mean": 345.8, "layer": "C"}
            ]
        }
    }',
    1,
    '教务处主任',
    'active'
);

-- 2. 创建层次对比分析
INSERT INTO biz_score_analysis (
    analysis_id, exam_id, exam_name, grade_level, 
    analysis_type, analysis_scope, 
    analysis_data,
    created_by, created_by_name,
    status
) VALUES (
    'ANALYSIS_20250224_002',
    1,
    '七年级期中教学调研',
    '7年级',
    'layer_comparison',
    'all',
    '{
        "layer_statistics": {
            "A": {
                "class_count": 2,
                "student_count": 78,
                "mean": 421.95,
                "std": 45.2,
                "pass_rate": 97.44,
                "excellent_rate": 43.59
            },
            "B": {
                "class_count": 3,
                "student_count": 120,
                "mean": 388.77,
                "std": 52.8,
                "pass_rate": 91.67,
                "excellent_rate": 15.83
            },
            "C": {
                "class_count": 3,
                "student_count": 117,
                "mean": 352.17,
                "std": 58.3,
                "pass_rate": 79.49,
                "excellent_rate": 2.56
            }
        },
        "t_test_results": {
            "A_vs_B": {"t_statistic": 4.82, "p_value": 0.0001, "significant": true},
            "B_vs_C": {"t_statistic": 4.35, "p_value": 0.0002, "significant": true},
            "A_vs_C": {"t_statistic": 8.92, "p_value": 0.0000, "significant": true}
        },
        "chart_data": {
            "layer_comparison": [
                {"layer": "A层(提高班)", "mean": 421.95, "pass_rate": 97.44, "count": 78},
                {"layer": "B层(平行班)", "mean": 388.77, "pass_rate": 91.67, "count": 120},
                {"layer": "C层(基础班)", "mean": 352.17, "pass_rate": 79.49, "count": 117}
            ],
            "class_comparison": [
                {"class": "701班", "mean": 425.6, "layer": "A"},
                {"class": "702班", "mean": 418.3, "layer": "A"},
                {"class": "703班", "mean": 395.2, "layer": "B"},
                {"class": "704班", "mean": 388.7, "layer": "B"},
                {"class": "705班", "mean": 382.4, "layer": "B"},
                {"class": "706班", "mean": 358.6, "layer": "C"},
                {"class": "707班", "mean": 352.1, "layer": "C"},
                {"class": "708班", "mean": 345.8, "layer": "C"}
            ]
        }
    }',
    1,
    '教务处主任',
    'active'
);

-- 3. 创建学科分析
INSERT INTO biz_score_analysis (
    analysis_id, exam_id, exam_name, grade_level, 
    analysis_type, analysis_scope, 
    analysis_data,
    created_by, created_by_name,
    status
) VALUES (
    'ANALYSIS_20250224_003',
    1,
    '七年级期中教学调研',
    '7年级',
    'subject_analysis',
    'all',
    '{
        "subject_statistics": {
            "语文": {"mean": 78.5, "std": 12.3, "pass_rate": 92.1, "excellent_rate": 25.4},
            "数学": {"mean": 76.2, "std": 18.5, "pass_rate": 85.7, "excellent_rate": 22.1},
            "英语": {"mean": 82.1, "std": 10.8, "pass_rate": 94.3, "excellent_rate": 31.2},
            "科学": {"mean": 79.8, "std": 14.2, "pass_rate": 89.5, "excellent_rate": 28.7},
            "社会": {"mean": 69.0, "std": 15.6, "pass_rate": 76.8, "excellent_rate": 15.2}
        },
        "subject_ranking": ["英语", "科学", "语文", "数学", "社会"],
        "chart_data": {
            "subject_scores": [
                {"subject": "语文", "mean": 78.5, "pass_rate": 92.1},
                {"subject": "数学", "mean": 76.2, "pass_rate": 85.7},
                {"subject": "英语", "mean": 82.1, "pass_rate": 94.3},
                {"subject": "科学", "mean": 79.8, "pass_rate": 89.5},
                {"subject": "社会", "mean": 69.0, "pass_rate": 76.8}
            ]
        }
    }',
    1,
    '教务处主任',
    'active'
);

SELECT '演示分析数据创建完成' as result;

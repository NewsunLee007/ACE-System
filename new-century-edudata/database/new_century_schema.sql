SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. 系统角色表 (10色RBAC权限体系)
-- ============================================
CREATE TABLE `sys_roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT '角色ID',
  `role_name` VARCHAR(50) NOT NULL COMMENT '角色名称(如：教务主任, 年段长, 班主任)',
  `permission_code` VARCHAR(50) NOT NULL COMMENT '权限标识(如: admin, grade_leader, headmaster)',
  `description` VARCHAR(255) COMMENT '角色描述',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统角色表-10色RBAC权限体系';

-- 初始化10色权限角色
INSERT INTO `sys_roles` (`role_name`, `permission_code`, `description`) VALUES
('教务处主任/校领导', 'edu_admin', '全校数据最高权限，配置全局分层，监控各年级质量'),
('考务与学籍管理员', 'exam_admin', '负责考试创建、基础数据导入校验、异动记录修改'),
('年段长', 'grade_leader', '纵览所在年段所有班级、全学科的成绩报表'),
('教研组长', 'subject_leader', '垂直穿透查看本学科在各年级的横向对比数据'),
('备课组长', 'lesson_leader', '查看本学科在当年段各班的成绩与标准差'),
('班主任', 'headmaster', '仅限查看本班学生的全科成绩、进退步斜率，管理期末评语'),
('科任教师', 'teacher', '仅限查看本人所授班级的对应学科详情及所教学生的全科总分参考'),
('家长/学生', 'parent', '移动端受限访问，仅能查询个人的历次详细成绩、进退步趋势'),
('系统管理员', 'sys_admin', '系统配置与维护'),
('自定义角色', 'custom', '支持灵活的权限复用与重组');

-- ============================================
-- 2. 系统用户表 (教师/管理层/家长)
-- ============================================
CREATE TABLE `sys_users` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  `role_id` INT NOT NULL COMMENT '角色ID',
  `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '登录名(教师工号/家长手机号)',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '加密密码(BCrypt)',
  `real_name` VARCHAR(50) NOT NULL COMMENT '真实姓名',
  `phone` VARCHAR(20) COMMENT '联系电话',
  `email` VARCHAR(100) COMMENT '邮箱',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用: 1启用, 0禁用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`role_id`) REFERENCES `sys_roles`(`id`),
  INDEX `idx_username` (`username`),
  INDEX `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- ============================================
-- 3. 角色前端配置扩展表
-- ============================================
CREATE TABLE `sys_role_settings` (
  `role_id` INT PRIMARY KEY COMMENT '系统角色ID',
  `frontend_role_id` VARCHAR(80) NOT NULL UNIQUE COMMENT '前端角色标识',
  `display_level` INT DEFAULT 1 COMMENT '前端显示级别',
  `permissions_json` TEXT COMMENT '权限标识JSON数组',
  `is_system` TINYINT(1) DEFAULT 0 COMMENT '是否系统预设角色',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`role_id`) REFERENCES `sys_roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色前端配置扩展表';

-- ============================================
-- 4. 家长资料与学生绑定表
-- ============================================
CREATE TABLE `biz_parent_profiles` (
  `parent_user_id` BIGINT PRIMARY KEY COMMENT '家长用户ID',
  `relation` VARCHAR(20) DEFAULT '父亲' COMMENT '默认亲属关系',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`parent_user_id`) REFERENCES `sys_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长资料扩展表';

-- ============================================
-- 4. 学生档案表 (核心底座 - 学籍辅号为唯一标识)
-- ============================================
CREATE TABLE `biz_students` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '学生内部ID',
  `student_code` VARCHAR(50) NOT NULL UNIQUE COMMENT '学籍辅号(全局唯一核心键)',
  `name` VARCHAR(50) NOT NULL COMMENT '学生姓名',
  `gender` TINYINT(1) DEFAULT 1 COMMENT '性别: 1男, 0女',
  `enrollment_year` INT NOT NULL COMMENT '入学年份(如 2024)',
  `current_grade` VARCHAR(20) COMMENT '当前年级(如 7年级)',
  `current_class` VARCHAR(20) COMMENT '当前班级(如 701)',
  `id_card_last6` VARCHAR(6) COMMENT '身份证号后6位(用于家长端鉴权)',
  `status` VARCHAR(20) DEFAULT '在读' COMMENT '状态: 在读/休学/转学/毕业',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX `idx_student_code` (`student_code`),
  INDEX `idx_current_class` (`current_class`),
  INDEX `idx_enrollment_year` (`enrollment_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生档案表-以学籍辅号为唯一标识';

CREATE TABLE `biz_parent_student_rel` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '绑定ID',
  `parent_user_id` BIGINT NOT NULL COMMENT '家长用户ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `relation` VARCHAR(20) DEFAULT '父亲' COMMENT '亲属关系',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否有效',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`parent_user_id`) REFERENCES `sys_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_parent_student` (`parent_user_id`, `student_id`),
  INDEX `idx_parent_user` (`parent_user_id`),
  INDEX `idx_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长学生绑定关系表';

-- ============================================
-- 5. 班级基础信息表
-- ============================================
CREATE TABLE `biz_classes` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '内部ID',
  `class_code` VARCHAR(20) NOT NULL UNIQUE COMMENT '班级编号，如701',
  `class_no` VARCHAR(20) NOT NULL COMMENT '班级序号，如01',
  `name` VARCHAR(100) NOT NULL COMMENT '班级名称',
  `enrollment_year` INT NOT NULL COMMENT '入学年份',
  `classroom_location` VARCHAR(100) COMMENT '教室位置',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT 'active/inactive',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_enrollment_class_no` (`enrollment_year`, `class_no`),
  INDEX `idx_class_status` (`status`),
  INDEX `idx_enrollment_year` (`enrollment_year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级基础信息表';

-- ============================================
-- 6. 学籍异动记录表
-- ============================================
CREATE TABLE `biz_status_changes` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `term` VARCHAR(20) NOT NULL COMMENT '发生学期(如 2025-1)',
  `change_type` VARCHAR(20) NOT NULL COMMENT '异动类型: 转学/休学/复学/借读/退学',
  `change_date` DATE NOT NULL COMMENT '异动具体时间',
  `reason` VARCHAR(255) COMMENT '异动原因',
  `from_class` VARCHAR(20) COMMENT '原班级',
  `to_class` VARCHAR(20) COMMENT '目标班级',
  `created_by` BIGINT COMMENT '操作人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`) ON DELETE CASCADE,
  INDEX `idx_student_term` (`student_id`, `term`),
  INDEX `idx_change_date` (`change_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学籍异动记录表';

-- ============================================
-- 5. 教师班级关系表 (解绑教师与成绩的直接关联)
-- ============================================
-- 核心设计: 成绩数据的底层外键不直接绑定教师ID
-- 而是以"班级 + 科目 + 学期"为联合核心进行组织
-- 支持教师中途接班/代课的历史追溯
CREATE TABLE `biz_teacher_class_rel` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '关系ID',
  `teacher_id` BIGINT NOT NULL COMMENT '教师用户ID',
  `term` VARCHAR(20) NOT NULL COMMENT '任教学期(如 2025-1)',
  `grade_name` VARCHAR(20) NOT NULL COMMENT '年级(如 7年级)',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级(如 701)',
  `subject_name` VARCHAR(50) COMMENT '任教科任(如 英语, 为空代表班主任)',
  `is_headmaster` TINYINT(1) DEFAULT 0 COMMENT '是否班主任: 1是, 0否',
  `start_date` DATE COMMENT '接班开始日期',
  `end_date` DATE COMMENT '接班结束日期(空表示至今)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (`teacher_id`) REFERENCES `sys_users`(`id`),
  UNIQUE KEY `uk_term_class_subject` (`term`, `class_name`, `subject_name`),
  INDEX `idx_teacher_term` (`teacher_id`, `term`),
  INDEX `idx_class_term` (`class_name`, `term`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师班级关系表-解绑教师与成绩直接关联';

-- ============================================
-- 6. 教师职务任命表 (支持多职务，不覆盖基础角色)
-- ============================================
CREATE TABLE `biz_teacher_duties` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '教师职务ID',
  `teacher_id` BIGINT NOT NULL COMMENT '教师用户ID',
  `duty_type` VARCHAR(50) NOT NULL COMMENT '职务类型: head_teacher/lesson_leader/research_leader/grade_leader/grade_deputy/dept_director/dept_deputy/vice_principal/principal',
  `term` VARCHAR(20) NOT NULL COMMENT '学期',
  `grade_name` VARCHAR(20) COMMENT '职务年级',
  `subject_name` VARCHAR(50) COMMENT '职务学科',
  `class_name` VARCHAR(20) COMMENT '班级范围',
  `scope_label` VARCHAR(100) COMMENT '职务范围说明',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否有效',
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '任命时间',
  `ended_at` TIMESTAMP NULL COMMENT '解除时间',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  FOREIGN KEY (`teacher_id`) REFERENCES `sys_users`(`id`),
  INDEX `idx_teacher_duty_term` (`teacher_id`, `term`, `duty_type`),
  INDEX `idx_duty_scope` (`duty_type`, `term`, `grade_name`, `subject_name`, `class_name`),
  INDEX `idx_duty_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师职务任命表';

-- ============================================
-- 6. 学科目录表
-- ============================================
CREATE TABLE `biz_subjects` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '学科ID',
  `name` VARCHAR(50) NOT NULL COMMENT '学科名称',
  `code` VARCHAR(20) COMMENT '学科代码',
  `description` VARCHAR(255) COMMENT '学科说明',
  `sort_order` INT DEFAULT 0 COMMENT '排序',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_subject_name` (`name`),
  INDEX `idx_subject_active_order` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学科目录表';

INSERT INTO `biz_subjects` (`name`, `code`, `description`, `sort_order`) VALUES
('语文', 'YW', '基础学科', 1),
('数学', 'SX', '基础学科', 2),
('英语', 'YY', '外语学科', 3),
('科学', 'KX', '综合科学', 4),
('社会', 'SH', '社会学科', 5);

-- ============================================
-- 7. 考试基础信息表
-- ============================================
CREATE TABLE `biz_exams` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '考试ID',
  `exam_name` VARCHAR(100) NOT NULL COMMENT '考试名称(如 2025-1 7年级教学调研)',
  `term` VARCHAR(20) NOT NULL COMMENT '学期(如 2025-1)',
  `exam_type` VARCHAR(20) COMMENT '考试类型: 期中/期末/月考/统测',
  `grade_level` VARCHAR(20) COMMENT '年级(如 7年级)',
  `exam_date` DATE COMMENT '考试日期',
  `subjects` JSON COMMENT '本次考试包含的科目列表',
  `full_score` DECIMAL(6,1) DEFAULT 500.0 COMMENT '满分总分',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX `idx_term_grade` (`term`, `grade_level`),
  INDEX `idx_exam_date` (`exam_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考试基础信息表';

-- ============================================
-- 8. 成绩明细表 (宽表设计 - 空间换时间)
-- ============================================
-- 核心字段 is_included: 被标记为0的学生成绩只做记录
-- 绝对不纳入班级/层级的均分、及格率、Z值计算的分子与分母中
CREATE TABLE `biz_scores` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '成绩ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `exam_number` VARCHAR(50) COMMENT '考场考号',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级名称(冗余存储便于统计)',
  `score_chinese` DECIMAL(5,1) DEFAULT NULL COMMENT '语文成绩',
  `score_math` DECIMAL(5,1) DEFAULT NULL COMMENT '数学成绩',
  `score_english` DECIMAL(5,1) DEFAULT NULL COMMENT '英语成绩',
  `score_science` DECIMAL(5,1) DEFAULT NULL COMMENT '科学成绩',
  `score_society` DECIMAL(5,1) DEFAULT NULL COMMENT '社会成绩',
  `total_score` DECIMAL(6,1) DEFAULT NULL COMMENT '总分',
  `is_included` TINYINT(1) DEFAULT 1 COMMENT '是否参与统计: 1参与, 0不参与(缺考/缓考)',
  `remarks` VARCHAR(100) COMMENT '备注(如: 缺考, 缓考, 作弊)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '录入时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_exam_student` (`exam_id`, `student_id`),
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`),
  INDEX `idx_exam_class` (`exam_id`, `class_name`),
  INDEX `idx_is_included` (`is_included`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩明细表-宽表设计';

-- ============================================
-- 9. 自定义班级分层主表 (横向对比层级)
-- ============================================
-- 支持在每次统测时自定义"对比层级"
-- 如: A层=701-710班, B层=701-712班
CREATE TABLE `biz_class_layers` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '分层ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_name` VARCHAR(50) NOT NULL COMMENT '分层名称(如 A层, B层, 全段)',
  `description` VARCHAR(255) COMMENT '分层描述',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer` (`exam_id`, `layer_name`),
  INDEX `idx_exam_id` (`exam_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级分层主表-横向对比层级';

-- ============================================
-- 10. 自定义班级分层明细表
-- ============================================
CREATE TABLE `biz_class_layer_details` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID',
  `layer_id` BIGINT NOT NULL COMMENT '分层ID',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级名称(如 701)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  FOREIGN KEY (`layer_id`) REFERENCES `biz_class_layers`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_layer_class` (`layer_id`, `class_name`),
  INDEX `idx_layer_id` (`layer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级分层明细表';

-- ============================================
-- 11. 班级Z值计算结果缓存表 (提升查询性能)
-- ============================================
CREATE TABLE `biz_class_z_values` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_id` BIGINT NOT NULL COMMENT '分层ID',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级名称',
  `class_mean` DECIMAL(6,2) COMMENT '班级平均分',
  `layer_mean` DECIMAL(6,2) COMMENT '分层年级平均分',
  `layer_std` DECIMAL(6,4) COMMENT '分层标准差',
  `standard_score` DECIMAL(8,4) COMMENT '统计学标准分',
  `top20_ratio` DECIMAL(5,4) COMMENT '前20%贡献率',
  `top80_ratio` DECIMAL(5,4) COMMENT '前80%贡献率',
  `final_z_value` DECIMAL(8,4) COMMENT '最终班级Z值(50-20-30加权)',
  `class_count` INT COMMENT '班级有效人数',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`layer_id`) REFERENCES `biz_class_layers`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer_class` (`exam_id`, `layer_id`, `class_name`),
  INDEX `idx_z_value` (`final_z_value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级Z值计算结果缓存表';

-- ============================================
-- 12. 学科有效分/下限分计算结果表
-- ============================================
CREATE TABLE `biz_subject_thresholds` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_id` BIGINT NOT NULL COMMENT '分层ID',
  `percentage` DECIMAL(3,2) NOT NULL COMMENT '百分比(如 0.20 表示前20%)',
  `threshold_total` DECIMAL(6,1) COMMENT '总分下限分',
  `threshold_chinese` DECIMAL(5,1) COMMENT '语文下限分',
  `threshold_math` DECIMAL(5,1) COMMENT '数学下限分',
  `threshold_english` DECIMAL(5,1) COMMENT '英语下限分',
  `threshold_science` DECIMAL(5,1) COMMENT '科学下限分',
  `threshold_society` DECIMAL(5,1) COMMENT '社会下限分',
  `student_count` INT COMMENT '达标人数',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`layer_id`) REFERENCES `biz_class_layers`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer_pct` (`exam_id`, `layer_id`, `percentage`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学科有效分/下限分计算结果表';

-- ============================================
-- 13. 学生历史成绩趋势表 (用于进退步分析)
-- ============================================
CREATE TABLE `biz_student_trends` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `term` VARCHAR(20) NOT NULL COMMENT '学期',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级',
  `total_score` DECIMAL(6,1) COMMENT '总分',
  `class_rank` INT COMMENT '班级排名',
  `layer_rank` INT COMMENT '分层排名',
  `rank_change` INT COMMENT '排名变化(正数上升,负数下降)',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_student_exam` (`student_id`, `exam_id`),
  INDEX `idx_student_term` (`student_id`, `term`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生历史成绩趋势表';

-- ============================================
-- 14. 成绩分析结果包缓存表
-- ============================================
CREATE TABLE `biz_score_analysis_bundles` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '内部ID',
  `bundle_id` VARCHAR(80) NOT NULL UNIQUE COMMENT '结果包ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `exam_name` VARCHAR(120) NOT NULL COMMENT '考试名称',
  `grade_level` VARCHAR(20) NOT NULL COMMENT '年级',
  `status` VARCHAR(20) DEFAULT 'ready' COMMENT '结果包状态',
  `result_json` LONGTEXT NOT NULL COMMENT '结果包JSON',
  `source_hash` VARCHAR(80) DEFAULT NULL COMMENT '来源数据版本',
  `generated_by` BIGINT DEFAULT NULL COMMENT '生成人',
  `generated_by_name` VARCHAR(80) DEFAULT NULL COMMENT '生成人姓名',
  `generated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY `uk_exam_grade_bundle` (`exam_id`, `grade_level`),
  INDEX `idx_grade_generated_at` (`grade_level`, `generated_at`),
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩分析结果包缓存表';

-- ============================================
-- 15. 成绩排名与分析可见性设置表
-- ============================================
CREATE TABLE `sys_score_visibility_settings` (
  `role_code` VARCHAR(50) PRIMARY KEY COMMENT '权限角色代码',
  `settings_json` TEXT NOT NULL COMMENT '成绩可见性JSON',
  `updated_by` BIGINT DEFAULT NULL COMMENT '最后修改人',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩排名与分析可见性设置';

SET FOREIGN_KEY_CHECKS = 1;

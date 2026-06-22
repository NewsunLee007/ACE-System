-- ============================================
-- 成绩分析分层体系扩展表结构
-- 支持全年级范围分析、分层维度统计、分层推送
-- ============================================

-- 1. 分层定义配置表
CREATE TABLE IF NOT EXISTS `biz_layer_definitions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '分层定义ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '层次代码(ALL/A/B/C)',
  `layer_name` VARCHAR(50) NOT NULL COMMENT '层次名称',
  `layer_type` VARCHAR(20) NOT NULL COMMENT '层次类型(all/grade/layer/custom)',
  `description` VARCHAR(255) COMMENT '层次描述',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_layer_code` (`layer_code`),
  INDEX `idx_layer_type` (`layer_type`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层定义配置表';

-- 初始化分层定义
INSERT INTO `biz_layer_definitions` (`layer_code`, `layer_name`, `layer_type`, `description`, `sort_order`) VALUES
('ALL', '全年级', 'all', '包含全年级的所有学生', 0),
('A', 'A层(实验班)', 'layer', '学业水平较高的班级层次', 1),
('B', 'B层(创新班)', 'layer', '标准教学班级层次', 2),
('C', 'C层(平行班)', 'layer', '基础教学班级层次', 3);

-- 2. 考试分层配置表
CREATE TABLE IF NOT EXISTS `biz_exam_layer_configs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '配置ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_id` BIGINT NOT NULL COMMENT '分层ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '层次代码',
  `config_type` VARCHAR(20) NOT NULL DEFAULT 'auto' COMMENT '配置类型(auto/manual)',
  `included_classes` JSON COMMENT '包含的班级列表',
  `excluded_students` JSON COMMENT '排除的学生ID列表',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`layer_id`) REFERENCES `biz_class_layers`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer` (`exam_id`, `layer_id`),
  INDEX `idx_exam_id` (`exam_id`),
  INDEX `idx_layer_code` (`layer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考试分层配置表';

-- 3. 分层成绩统计结果表
CREATE TABLE IF NOT EXISTS `biz_layered_statistics` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '统计ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '层次代码(ALL/A/B/C)',
  `subject_name` VARCHAR(50) NOT NULL COMMENT '学科名称(total/chinese/math/english/science/society)',
  `total_students` INT NOT NULL COMMENT '学生总数',
  `valid_students` INT NOT NULL COMMENT '有效学生数',
  `mean_score` DECIMAL(6,2) COMMENT '平均分',
  `median_score` DECIMAL(6,2) COMMENT '中位数',
  `std_score` DECIMAL(6,4) COMMENT '标准差',
  `max_score` DECIMAL(6,1) COMMENT '最高分',
  `min_score` DECIMAL(6,1) COMMENT '最低分',
  `q1_score` DECIMAL(6,2) COMMENT '第一四分位数',
  `q3_score` DECIMAL(6,2) COMMENT '第三四分位数',
  `pass_count` INT COMMENT '及格人数',
  `pass_rate` DECIMAL(5,2) COMMENT '及格率',
  `excellent_count` INT COMMENT '优秀人数',
  `excellent_rate` DECIMAL(5,2) COMMENT '优秀率',
  `fail_count` INT COMMENT '不及格人数',
  `fail_rate` DECIMAL(5,2) COMMENT '不及格率',
  `score_distribution` JSON COMMENT '分数段分布数据',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer_subject` (`exam_id`, `layer_code`, `subject_name`),
  INDEX `idx_exam_layer` (`exam_id`, `layer_code`),
  INDEX `idx_calculated_at` (`calculated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层成绩统计结果表';

-- 4. 分层临界分计算结果表
CREATE TABLE IF NOT EXISTS `biz_layered_thresholds` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '临界分ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '层次代码(ALL/A/B/C)',
  `percentage` DECIMAL(3,2) NOT NULL COMMENT '百分比(0.20表示前20%)',
  `threshold_total` DECIMAL(6,1) COMMENT '总分临界分',
  `threshold_chinese` DECIMAL(5,1) COMMENT '语文临界分',
  `threshold_math` DECIMAL(5,1) COMMENT '数学临界分',
  `threshold_english` DECIMAL(5,1) COMMENT '英语临界分',
  `threshold_science` DECIMAL(5,1) COMMENT '科学临界分',
  `threshold_society` DECIMAL(5,1) COMMENT '社会临界分',
  `student_count` INT COMMENT '达标人数',
  `calculated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '计算时间',
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_exam_layer_pct` (`exam_id`, `layer_code`, `percentage`),
  INDEX `idx_exam_layer` (`exam_id`, `layer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层临界分计算结果表';

-- 5. 分层推送记录表
CREATE TABLE IF NOT EXISTS `biz_layered_notifications` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '推送ID',
  `notification_id` VARCHAR(50) NOT NULL COMMENT '推送批次ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '目标层次代码',
  `title` VARCHAR(200) NOT NULL COMMENT '推送标题',
  `content` TEXT COMMENT '推送内容',
  `notification_type` VARCHAR(50) NOT NULL COMMENT '推送类型(teacher/parent/system)',
  `target_role` VARCHAR(50) NOT NULL COMMENT '目标角色',
  `target_users` JSON COMMENT '目标用户ID列表',
  `sent_count` INT DEFAULT 0 COMMENT '发送人数',
  `read_count` INT DEFAULT 0 COMMENT '已读人数',
  `status` VARCHAR(20) DEFAULT 'pending' COMMENT '状态(pending/sent/failed)',
  `sent_at` TIMESTAMP NULL COMMENT '发送时间',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_notification_id` (`notification_id`),
  INDEX `idx_exam_layer` (`exam_id`, `layer_code`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层推送记录表';

-- 6. 分层推送接收明细表
CREATE TABLE IF NOT EXISTS `biz_layered_notification_recipients` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID',
  `notification_id` VARCHAR(50) NOT NULL COMMENT '推送批次ID',
  `user_id` BIGINT NOT NULL COMMENT '接收用户ID',
  `user_role` VARCHAR(50) NOT NULL COMMENT '用户角色',
  `user_name` VARCHAR(50) COMMENT '用户姓名',
  `layer_code` VARCHAR(10) COMMENT '用户所属层次',
  `class_name` VARCHAR(20) COMMENT '用户所属班级',
  `read_status` VARCHAR(20) DEFAULT 'unread' COMMENT '阅读状态(unread/read)',
  `read_at` TIMESTAMP NULL COMMENT '阅读时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`notification_id`) REFERENCES `biz_layered_notifications`(`notification_id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_notification_user` (`notification_id`, `user_id`),
  INDEX `idx_notification_id` (`notification_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_read_status` (`read_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层推送接收明细表';

-- 7. 用户分层权限表
CREATE TABLE IF NOT EXISTS `biz_user_layer_permissions` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '权限ID',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `user_role` VARCHAR(50) NOT NULL COMMENT '用户角色',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '可访问的层次代码',
  `class_name` VARCHAR(20) COMMENT '可访问的班级(为空表示该层次所有班级)',
  `permission_type` VARCHAR(20) NOT NULL DEFAULT 'view' COMMENT '权限类型(view/push/admin)',
  `grant_by` BIGINT COMMENT '授权人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `sys_users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_user_layer_class` (`user_id`, `layer_code`, `class_name`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_layer_code` (`layer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户分层权限表';

-- 8. 家长学生分层关联表
CREATE TABLE IF NOT EXISTS `biz_parent_student_layer` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '关联ID',
  `parent_user_id` BIGINT NOT NULL COMMENT '家长用户ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '学生所在层次',
  `class_name` VARCHAR(20) NOT NULL COMMENT '学生所在班级',
  `academic_year` VARCHAR(20) NOT NULL COMMENT '学年',
  `term` VARCHAR(10) NOT NULL COMMENT '学期',
  `is_active` TINYINT(1) DEFAULT 1 COMMENT '是否有效',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`parent_user_id`) REFERENCES `sys_users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_parent_student_term` (`parent_user_id`, `student_id`, `academic_year`, `term`),
  INDEX `idx_parent_user` (`parent_user_id`),
  INDEX `idx_student` (`student_id`),
  INDEX `idx_layer_code` (`layer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家长学生分层关联表';

-- 9. 分层分析日志表
CREATE TABLE IF NOT EXISTS `biz_layered_analysis_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `exam_id` BIGINT COMMENT '考试ID',
  `layer_code` VARCHAR(10) COMMENT '层次代码',
  `action_type` VARCHAR(50) NOT NULL COMMENT '操作类型(calculate/push/export/view)',
  `action_by` BIGINT NOT NULL COMMENT '操作人ID',
  `action_by_name` VARCHAR(50) COMMENT '操作人姓名',
  `action_by_role` VARCHAR(50) COMMENT '操作人角色',
  `action_detail` JSON COMMENT '操作详情',
  `ip_address` VARCHAR(50) COMMENT 'IP地址',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_exam_layer` (`exam_id`, `layer_code`),
  INDEX `idx_action_by` (`action_by`),
  INDEX `idx_action_type` (`action_type`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分层分析日志表';

-- 10. 创建分层统计汇总视图
CREATE OR REPLACE VIEW `view_layered_statistics_summary` AS
SELECT 
  ls.exam_id,
  e.exam_name,
  e.grade_level,
  e.exam_date,
  ls.layer_code,
  ld.layer_name,
  COUNT(DISTINCT ls.subject_name) as subject_count,
  MAX(CASE WHEN ls.subject_name = 'total' THEN ls.mean_score END) as total_mean,
  MAX(CASE WHEN ls.subject_name = 'total' THEN ls.pass_rate END) as total_pass_rate,
  MAX(CASE WHEN ls.subject_name = 'total' THEN ls.excellent_rate END) as total_excellent_rate,
  MAX(CASE WHEN ls.subject_name = 'total' THEN ls.valid_students END) as total_students,
  MAX(ls.calculated_at) as last_calculated_at
FROM biz_layered_statistics ls
JOIN biz_exams e ON ls.exam_id = e.id
JOIN biz_layer_definitions ld ON ls.layer_code = ld.layer_code
GROUP BY ls.exam_id, ls.layer_code;

-- 11. 创建分层推送统计视图
CREATE OR REPLACE VIEW `view_layered_notification_summary` AS
SELECT 
  ln.exam_id,
  ln.layer_code,
  ln.notification_type,
  ln.target_role,
  COUNT(*) as total_notifications,
  SUM(ln.sent_count) as total_sent,
  SUM(ln.read_count) as total_read,
  ROUND(SUM(ln.read_count) / NULLIF(SUM(ln.sent_count), 0) * 100, 2) as read_rate,
  MAX(ln.sent_at) as last_sent_at
FROM biz_layered_notifications ln
WHERE ln.status = 'sent'
GROUP BY ln.exam_id, ln.layer_code, ln.notification_type, ln.target_role;

-- 12. 初始化默认权限配置
INSERT INTO `biz_analysis_configs` (`config_key`, `config_value`, `description`) VALUES
('layered_analysis_enabled', 'true', '是否启用分层分析功能'),
('layered_push_enabled', 'true', '是否启用分层推送功能'),
('default_layer_percentages', '[0.20, 0.40, 0.60, 0.80]', '默认分层临界分百分比'),
('teacher_layer_permissions', '{"headmaster": ["view", "push"], "teacher": ["view"]}', '教师分层权限配置'),
('parent_data_isolation', 'true', '家长数据隔离开关')
ON DUPLICATE KEY UPDATE 
  config_value = VALUES(config_value),
  description = VALUES(description);

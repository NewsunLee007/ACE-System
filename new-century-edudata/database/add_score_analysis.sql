-- ============================================
-- 成绩分析模块数据库表结构
-- 支持分层教学分析和成果发布
-- ============================================

-- 1. 班级层次设定表
CREATE TABLE IF NOT EXISTS `biz_class_layers` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `grade_level` VARCHAR(20) NOT NULL COMMENT '年级(如: 7年级)',
  `class_id` BIGINT NOT NULL COMMENT '班级ID',
  `class_name` VARCHAR(20) NOT NULL COMMENT '班级名称(如: 701)',
  `layer_code` VARCHAR(10) NOT NULL COMMENT '层次代码(A/B/C)',
  `layer_name` VARCHAR(50) COMMENT '层次名称(如: 提高班/平行班/基础班)',
  `academic_year` VARCHAR(20) NOT NULL COMMENT '学年(如: 2024-2025)',
  `term` VARCHAR(10) NOT NULL COMMENT '学期(如: 1/2)',
  `description` VARCHAR(255) COMMENT '说明',
  `created_by` BIGINT COMMENT '创建人ID',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uk_grade_class_term` (`grade_level`, `class_id`, `academic_year`, `term`),
  INDEX `idx_layer_code` (`layer_code`),
  INDEX `idx_grade_layer` (`grade_level`, `layer_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='班级层次设定表';

-- 2. 成绩分析结果表
CREATE TABLE IF NOT EXISTS `biz_score_analysis` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `analysis_id` VARCHAR(50) NOT NULL COMMENT '分析批次ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `exam_name` VARCHAR(100) NOT NULL COMMENT '考试名称',
  `grade_level` VARCHAR(20) NOT NULL COMMENT '年级',
  `analysis_type` VARCHAR(50) NOT NULL COMMENT '分析类型(overall/layer_comparison/subject_analysis)',
  `analysis_scope` VARCHAR(50) NOT NULL COMMENT '分析范围(all/layer_a/layer_b/layer_c)',
  `analysis_data` JSON NOT NULL COMMENT '分析结果数据(JSON格式)',
  `created_by` BIGINT NOT NULL COMMENT '分析人ID',
  `created_by_name` VARCHAR(50) COMMENT '分析人姓名',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `status` VARCHAR(20) DEFAULT 'draft' COMMENT '状态(draft/published)',
  
  INDEX `idx_analysis_id` (`analysis_id`),
  INDEX `idx_exam_id` (`exam_id`),
  INDEX `idx_grade_level` (`grade_level`),
  INDEX `idx_created_at` (`created_at`),
  UNIQUE KEY `uk_exam_type_scope` (`exam_id`, `analysis_type`, `analysis_scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩分析结果表';

-- 3. 分析成果发布记录表
CREATE TABLE IF NOT EXISTS `biz_analysis_publications` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `publication_id` VARCHAR(50) NOT NULL COMMENT '发布批次ID',
  `analysis_id` VARCHAR(50) NOT NULL COMMENT '关联的分析批次ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `exam_name` VARCHAR(100) NOT NULL COMMENT '考试名称',
  `grade_level` VARCHAR(20) NOT NULL COMMENT '年级',
  `title` VARCHAR(200) NOT NULL COMMENT '发布标题',
  `content_summary` TEXT COMMENT '内容摘要',
  `published_by` BIGINT NOT NULL COMMENT '发布人ID',
  `published_by_name` VARCHAR(50) COMMENT '发布人姓名',
  `published_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `recipient_types` JSON COMMENT '接收对象类型数组',
  `recipient_count` INT DEFAULT 0 COMMENT '接收人数',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT '状态(active/archived)',
  
  INDEX `idx_publication_id` (`publication_id`),
  INDEX `idx_analysis_id` (`analysis_id`),
  INDEX `idx_exam_id` (`exam_id`),
  INDEX `idx_published_at` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析成果发布记录表';

-- 4. 发布接收对象明细表
CREATE TABLE IF NOT EXISTS `biz_publication_recipients` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `publication_id` VARCHAR(50) NOT NULL COMMENT '发布批次ID',
  `user_id` BIGINT NOT NULL COMMENT '接收用户ID',
  `user_name` VARCHAR(50) COMMENT '接收用户姓名',
  `user_role` VARCHAR(50) COMMENT '用户角色',
  `read_status` VARCHAR(20) DEFAULT 'unread' COMMENT '阅读状态(unread/read)',
  `read_at` TIMESTAMP NULL COMMENT '阅读时间',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uk_pub_user` (`publication_id`, `user_id`),
  INDEX `idx_publication_id` (`publication_id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发布接收对象明细表';

-- 5. 成绩分析操作日志表
CREATE TABLE IF NOT EXISTS `biz_analysis_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `analysis_id` VARCHAR(50) COMMENT '分析批次ID',
  `publication_id` VARCHAR(50) COMMENT '发布批次ID',
  `action_type` VARCHAR(50) NOT NULL COMMENT '操作类型(create_analysis/update_analysis/publish/download/view)',
  `action_by` BIGINT NOT NULL COMMENT '操作人ID',
  `action_by_name` VARCHAR(50) COMMENT '操作人姓名',
  `action_by_role` VARCHAR(50) COMMENT '操作人角色',
  `action_detail` JSON COMMENT '操作详情',
  `ip_address` VARCHAR(50) COMMENT 'IP地址',
  `user_agent` VARCHAR(255) COMMENT '用户代理',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_analysis_id` (`analysis_id`),
  INDEX `idx_publication_id` (`publication_id`),
  INDEX `idx_action_by` (`action_by`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_action_type` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成绩分析操作日志表';

-- 6. 分析配置表
CREATE TABLE IF NOT EXISTS `biz_analysis_configs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `config_key` VARCHAR(100) NOT NULL COMMENT '配置键',
  `config_value` JSON NOT NULL COMMENT '配置值',
  `description` VARCHAR(255) COMMENT '配置说明',
  `updated_by` BIGINT COMMENT '更新人ID',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY `uk_config_key` (`config_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分析配置表';

-- 7. 初始化默认配置
INSERT INTO `biz_analysis_configs` (`config_key`, `config_value`, `description`) VALUES
('layer_definitions', '[{"code": "A", "name": "提高班", "description": "学业水平较高的班级"}, {"code": "B", "name": "平行班", "description": "标准教学班级"}, {"code": "C", "name": "基础班", "description": "需要加强基础的班级"}]', '层次定义配置'),
('analysis_dimensions', '["overall", "layer_comparison", "subject_analysis", "student_progress", "class_contrast"]', '分析维度配置'),
('publication_roles', '["school_leader", "middle_manager", "research_leader", "prep_leader", "grade_leader", "head_teacher", "teacher"]', '可接收发布的角色配置'),
('score_thresholds', '{"excellent": 90, "good": 80, "pass": 60, "fail": 60}', '成绩等级阈值配置');

-- 8. 创建分析统计视图
CREATE OR REPLACE VIEW `view_analysis_statistics` AS
SELECT 
  sa.exam_id,
  sa.grade_level,
  COUNT(*) as total_analysis_count,
  SUM(CASE WHEN sa.status = 'published' THEN 1 ELSE 0 END) as published_count,
  SUM(CASE WHEN sa.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
  MAX(sa.created_at) as last_analysis_time
FROM biz_score_analysis sa
GROUP BY sa.exam_id, sa.grade_level;

-- 9. 创建发布统计视图
CREATE OR REPLACE VIEW `view_publication_statistics` AS
SELECT 
  p.exam_id,
  p.grade_level,
  COUNT(*) as total_publications,
  SUM(p.recipient_count) as total_recipients,
  SUM(CASE WHEN pr.read_status = 'read' THEN 1 ELSE 0 END) as read_count,
  MAX(p.published_at) as last_publication_time
FROM biz_analysis_publications p
LEFT JOIN biz_publication_recipients pr ON p.publication_id = pr.publication_id
GROUP BY p.exam_id, p.grade_level;
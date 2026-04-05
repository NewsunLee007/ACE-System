-- ============================================-- 缺考管理表结构-- 用于记录学生缺考信息，支持教务处统一录入和班主任上报-- ============================================

-- 1. 缺考记录表
CREATE TABLE IF NOT EXISTS `biz_absence_records` (  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '缺考记录ID',
  `exam_id` BIGINT NOT NULL COMMENT '考试ID',
  `student_id` BIGINT NOT NULL COMMENT '学生ID',
  `student_code` VARCHAR(50) NOT NULL COMMENT '学籍辅号(冗余存储便于查询)',
  `student_name` VARCHAR(50) NOT NULL COMMENT '学生姓名(冗余存储)',
  `class_id` BIGINT COMMENT '班级ID',
  `class_name` VARCHAR(20) COMMENT '班级名称(如 701)',
  `absent_subjects` JSON COMMENT '缺考科目数组，如：["语文", "数学"]',
  `reason_type` VARCHAR(20) DEFAULT '其他' COMMENT '缺考原因类型: 病假/事假/旷考/其他',
  `reason_detail` VARCHAR(255) COMMENT '详细原因说明',
  `report_source` VARCHAR(20) DEFAULT '教务处' COMMENT '上报来源: 教务处/班主任',
  `reported_by` BIGINT COMMENT '上报人ID',
  `reported_by_name` VARCHAR(50) COMMENT '上报人姓名',
  `report_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上报时间',
  `status` VARCHAR(20) DEFAULT '待审核' COMMENT '状态: 待审核/已通过/已驳回',
  `audit_by` BIGINT COMMENT '审核人ID',
  `audit_by_name` VARCHAR(50) COMMENT '审核人姓名',
  `audit_time` TIMESTAMP NULL COMMENT '审核时间',
  `audit_comment` VARCHAR(255) COMMENT '审核意见',
  `attachments` JSON COMMENT '附件列表(如病假条照片URL数组)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- 外键约束
  FOREIGN KEY (`exam_id`) REFERENCES `biz_exams`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `biz_students`(`id`),
  FOREIGN KEY (`reported_by`) REFERENCES `sys_users`(`id`),
  FOREIGN KEY (`audit_by`) REFERENCES `sys_users`(`id`),
  
  -- 索引
  INDEX `idx_exam_student` (`exam_id`, `student_id`),
  INDEX `idx_exam_class` (`exam_id`, `class_name`),
  INDEX `idx_status` (`status`),
  INDEX `idx_report_source` (`report_source`),
  INDEX `idx_report_time` (`report_time`),
  UNIQUE KEY `uk_exam_student_subjects` (`exam_id`, `student_id`)  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='缺考记录表-支持教务处录入和班主任上报';

-- 2. 缺考记录操作日志表（用于审计追踪）
CREATE TABLE IF NOT EXISTS `biz_absence_logs` (  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `absence_id` BIGINT NOT NULL COMMENT '缺考记录ID',
  `action` VARCHAR(50) NOT NULL COMMENT '操作类型: 创建/修改/审核/删除',
  `action_by` BIGINT COMMENT '操作人ID',
  `action_by_name` VARCHAR(50) COMMENT '操作人姓名',
  `action_time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `old_values` JSON COMMENT '修改前的值',
  `new_values` JSON COMMENT '修改后的值',
  `remark` VARCHAR(255) COMMENT '备注',
  
  FOREIGN KEY (`absence_id`) REFERENCES `biz_absence_records`(`id`) ON DELETE CASCADE,
  INDEX `idx_absence_id` (`absence_id`),
  INDEX `idx_action_time` (`action_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='缺考记录操作日志表';

-- 3. 添加一些常用的缺考原因类型枚举值注释
-- 病假: 学生因病无法参加考试，需提供医院证明
-- 事假: 学生因特殊事由请假，需家长书面说明
-- 旷考: 学生无故缺考
-- 其他: 其他特殊情况

-- 4. 添加缺考统计视图（便于快速查询）
CREATE OR REPLACE VIEW `view_absence_statistics` AS
SELECT 
  exam_id,
  COUNT(*) as total_absence_count,
  SUM(CASE WHEN status = '待审核' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN status = '已通过' THEN 1 ELSE 0 END) as approved_count,
  SUM(CASE WHEN status = '已驳回' THEN 1 ELSE 0 END) as rejected_count,
  SUM(CASE WHEN report_source = '班主任' THEN 1 ELSE 0 END) as reported_by_teacher_count,
  SUM(CASE WHEN report_source = '教务处' THEN 1 ELSE 0 END) as reported_by_admin_count
FROM biz_absence_records
GROUP BY exam_id;

-- 5. 初始化测试数据（可选，开发阶段使用）
-- INSERT INTO `biz_absence_records` 
-- (`exam_id`, `student_id`, `student_code`, `student_name`, `class_name`, `absent_subjects`, `reason_type`, `reason_detail`, `report_source`, `status`)
-- VALUES 
-- (1, 1, '20240701001', '张三', '701', '["语文"]', '病假', '感冒发烧', '班主任', '待审核');
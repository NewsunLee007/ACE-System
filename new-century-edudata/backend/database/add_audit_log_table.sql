-- ============================================
-- 系统操作日志表 (新增)
-- 用于记录所有重要操作，便于审计和问题追踪
-- ============================================

CREATE TABLE `sys_audit_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `user_id` BIGINT COMMENT '操作用户ID',
  `username` VARCHAR(50) COMMENT '操作用户名',
  `operation` VARCHAR(100) NOT NULL COMMENT '操作类型(如: 登录, 导入成绩, 删除考试)',
  `module` VARCHAR(50) COMMENT '操作模块(如: auth, exam, student)',
  `description` TEXT COMMENT '操作描述',
  `ip_address` VARCHAR(50) COMMENT 'IP地址',
  `user_agent` VARCHAR(255) COMMENT '浏览器信息',
  `request_data` JSON COMMENT '请求数据(可选)',
  `response_data` JSON COMMENT '响应数据(可选)',
  `status` VARCHAR(20) DEFAULT 'success' COMMENT '操作状态: success/failed',
  `error_message` TEXT COMMENT '错误信息',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_operation` (`operation`),
  INDEX `idx_module` (`module`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统操作日志表';

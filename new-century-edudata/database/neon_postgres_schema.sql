-- Neon / PostgreSQL initialization schema for 新纪元教务平台.
-- Run with:
--   psql "$DATABASE_URL" -f database/neon_postgres_schema.sql

CREATE TABLE IF NOT EXISTS sys_roles (
  id SERIAL PRIMARY KEY,
  role_name VARCHAR(50) NOT NULL,
  permission_code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sys_roles (role_name, permission_code, description) VALUES
('教务处主任/校领导', 'edu_admin', '全校数据最高权限，配置全局分层，监控各年级质量'),
('考务与学籍管理员', 'exam_admin', '负责考试创建、基础数据导入校验、异动记录修改'),
('年段长', 'grade_leader', '纵览所在年段所有班级、全学科的成绩报表'),
('教研组长', 'subject_leader', '垂直穿透查看本学科在各年级的横向对比数据'),
('备课组长', 'lesson_leader', '查看本学科在当年段各班的成绩与标准差'),
('班主任', 'headmaster', '仅限查看本班学生的全科成绩、进退步斜率，管理期末评语'),
('科任教师', 'teacher', '仅限查看本人所授班级的对应学科详情及所教学生的全科总分参考'),
('家长/学生', 'parent', '移动端受限访问，仅能查询个人的历次详细成绩、进退步趋势'),
('系统管理员', 'sys_admin', '系统配置与维护'),
('自定义角色', 'custom', '支持灵活的权限复用与重组')
ON CONFLICT (permission_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS sys_users (
  id BIGSERIAL PRIMARY KEY,
  role_id INT NOT NULL REFERENCES sys_roles(id),
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sys_users_role_id ON sys_users (role_id);

CREATE TABLE IF NOT EXISTS sys_role_settings (
  role_id INT PRIMARY KEY REFERENCES sys_roles(id) ON DELETE CASCADE,
  frontend_role_id VARCHAR(80) NOT NULL UNIQUE,
  display_level INT DEFAULT 1,
  permissions_json TEXT,
  is_system SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biz_students (
  id BIGSERIAL PRIMARY KEY,
  student_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL,
  gender SMALLINT DEFAULT 1,
  enrollment_year INT NOT NULL,
  current_grade VARCHAR(20),
  current_class VARCHAR(20),
  id_card_last6 VARCHAR(6),
  status VARCHAR(20) DEFAULT '在读',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_students_current_class ON biz_students (current_class);
CREATE INDEX IF NOT EXISTS idx_students_enrollment_year ON biz_students (enrollment_year);

CREATE TABLE IF NOT EXISTS biz_parent_profiles (
  parent_user_id BIGINT PRIMARY KEY REFERENCES sys_users(id) ON DELETE CASCADE,
  relation VARCHAR(20) DEFAULT '父亲',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biz_parent_student_rel (
  id BIGSERIAL PRIMARY KEY,
  parent_user_id BIGINT NOT NULL REFERENCES sys_users(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES biz_students(id) ON DELETE CASCADE,
  relation VARCHAR(20) DEFAULT '父亲',
  is_active SMALLINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_parent_student UNIQUE (parent_user_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_parent_student_parent ON biz_parent_student_rel (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_student ON biz_parent_student_rel (student_id);

CREATE TABLE IF NOT EXISTS biz_classes (
  id BIGSERIAL PRIMARY KEY,
  class_code VARCHAR(20) NOT NULL UNIQUE,
  class_no VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  enrollment_year INT NOT NULL,
  classroom_location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_enrollment_class_no UNIQUE (enrollment_year, class_no)
);
CREATE INDEX IF NOT EXISTS idx_class_status ON biz_classes (status);
CREATE INDEX IF NOT EXISTS idx_class_enrollment_year ON biz_classes (enrollment_year);

CREATE TABLE IF NOT EXISTS biz_status_changes (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES biz_students(id) ON DELETE CASCADE,
  term VARCHAR(20) NOT NULL,
  change_type VARCHAR(20) NOT NULL,
  change_date DATE NOT NULL,
  reason VARCHAR(255),
  from_class VARCHAR(20),
  to_class VARCHAR(20),
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_status_student_term ON biz_status_changes (student_id, term);
CREATE INDEX IF NOT EXISTS idx_status_change_date ON biz_status_changes (change_date);

CREATE TABLE IF NOT EXISTS biz_teacher_class_rel (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES sys_users(id),
  term VARCHAR(20) NOT NULL,
  grade_name VARCHAR(20) NOT NULL,
  class_name VARCHAR(20) NOT NULL,
  subject_name VARCHAR(50),
  is_headmaster SMALLINT DEFAULT 0,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_term_class_subject UNIQUE (term, class_name, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_teacher_term ON biz_teacher_class_rel (teacher_id, term);
CREATE INDEX IF NOT EXISTS idx_class_term ON biz_teacher_class_rel (class_name, term);

CREATE TABLE IF NOT EXISTS biz_teacher_duties (
  id BIGSERIAL PRIMARY KEY,
  teacher_id BIGINT NOT NULL REFERENCES sys_users(id),
  duty_type VARCHAR(50) NOT NULL,
  term VARCHAR(20) NOT NULL,
  grade_name VARCHAR(20),
  subject_name VARCHAR(50),
  class_name VARCHAR(20),
  scope_label VARCHAR(100),
  is_active SMALLINT DEFAULT 1,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_teacher_duty_term ON biz_teacher_duties (teacher_id, term, duty_type);
CREATE INDEX IF NOT EXISTS idx_duty_scope ON biz_teacher_duties (duty_type, term, grade_name, subject_name, class_name);
CREATE INDEX IF NOT EXISTS idx_duty_active ON biz_teacher_duties (is_active);

CREATE TABLE IF NOT EXISTS biz_subjects (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  code VARCHAR(20),
  description VARCHAR(255),
  sort_order INT DEFAULT 0,
  is_active SMALLINT DEFAULT 1,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subject_active_order ON biz_subjects (is_active, sort_order);

INSERT INTO biz_subjects (name, code, description, sort_order) VALUES
('语文', 'YW', '基础学科', 1),
('数学', 'SX', '基础学科', 2),
('英语', 'YY', '外语学科', 3),
('科学', 'KX', '综合科学', 4),
('社会', 'SH', '社会学科', 5)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS biz_exams (
  id BIGSERIAL PRIMARY KEY,
  exam_name VARCHAR(100) NOT NULL,
  term VARCHAR(20) NOT NULL,
  exam_type VARCHAR(20),
  grade_level VARCHAR(20),
  exam_date DATE,
  subjects JSONB,
  full_score DECIMAL(6,1) DEFAULT 500.0,
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_exam_term_grade ON biz_exams (term, grade_level);
CREATE INDEX IF NOT EXISTS idx_exam_date ON biz_exams (exam_date);

CREATE TABLE IF NOT EXISTS biz_scores (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES biz_students(id),
  exam_number VARCHAR(50),
  class_name VARCHAR(20) NOT NULL,
  score_chinese DECIMAL(5,1),
  score_math DECIMAL(5,1),
  score_english DECIMAL(5,1),
  score_science DECIMAL(5,1),
  score_society DECIMAL(5,1),
  total_score DECIMAL(6,1),
  is_included SMALLINT DEFAULT 1,
  remarks VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_exam_student UNIQUE (exam_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_score_exam_class ON biz_scores (exam_id, class_name);
CREATE INDEX IF NOT EXISTS idx_score_included ON biz_scores (is_included);

CREATE TABLE IF NOT EXISTS biz_class_layers (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  layer_name VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_exam_layer UNIQUE (exam_id, layer_name)
);
CREATE INDEX IF NOT EXISTS idx_class_layers_exam ON biz_class_layers (exam_id);

CREATE TABLE IF NOT EXISTS biz_class_layer_details (
  id BIGSERIAL PRIMARY KEY,
  layer_id BIGINT NOT NULL REFERENCES biz_class_layers(id) ON DELETE CASCADE,
  class_name VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_layer_class UNIQUE (layer_id, class_name)
);
CREATE INDEX IF NOT EXISTS idx_layer_detail_layer ON biz_class_layer_details (layer_id);

CREATE TABLE IF NOT EXISTS biz_class_z_values (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  layer_id BIGINT NOT NULL REFERENCES biz_class_layers(id) ON DELETE CASCADE,
  class_name VARCHAR(20) NOT NULL,
  class_mean DECIMAL(6,2),
  layer_mean DECIMAL(6,2),
  layer_std DECIMAL(6,4),
  standard_score DECIMAL(8,4),
  top20_ratio DECIMAL(5,4),
  top80_ratio DECIMAL(5,4),
  final_z_value DECIMAL(8,4),
  class_count INT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_exam_layer_class UNIQUE (exam_id, layer_id, class_name)
);
CREATE INDEX IF NOT EXISTS idx_z_value ON biz_class_z_values (final_z_value);

CREATE TABLE IF NOT EXISTS biz_subject_thresholds (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  layer_id BIGINT NOT NULL REFERENCES biz_class_layers(id) ON DELETE CASCADE,
  percentage DECIMAL(3,2) NOT NULL,
  threshold_total DECIMAL(6,1),
  threshold_chinese DECIMAL(5,1),
  threshold_math DECIMAL(5,1),
  threshold_english DECIMAL(5,1),
  threshold_science DECIMAL(5,1),
  threshold_society DECIMAL(5,1),
  student_count INT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_subject_exam_layer_pct UNIQUE (exam_id, layer_id, percentage)
);

CREATE TABLE IF NOT EXISTS biz_layered_statistics (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  layer_code VARCHAR(10) NOT NULL,
  subject_name VARCHAR(50) NOT NULL,
  total_students INT NOT NULL,
  valid_students INT NOT NULL,
  mean_score DECIMAL(6,2),
  median_score DECIMAL(6,2),
  std_score DECIMAL(6,4),
  max_score DECIMAL(6,1),
  min_score DECIMAL(6,1),
  q1_score DECIMAL(6,2),
  q3_score DECIMAL(6,2),
  pass_count INT,
  pass_rate DECIMAL(5,2),
  excellent_count INT,
  excellent_rate DECIMAL(5,2),
  fail_count INT,
  fail_rate DECIMAL(5,2),
  score_distribution JSONB,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_exam_layer_subject UNIQUE (exam_id, layer_code, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_layered_statistics_exam_layer ON biz_layered_statistics (exam_id, layer_code);

CREATE TABLE IF NOT EXISTS biz_layered_thresholds (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  layer_code VARCHAR(10) NOT NULL,
  percentage DECIMAL(3,2) NOT NULL,
  threshold_total DECIMAL(6,1),
  threshold_chinese DECIMAL(5,1),
  threshold_math DECIMAL(5,1),
  threshold_english DECIMAL(5,1),
  threshold_science DECIMAL(5,1),
  threshold_society DECIMAL(5,1),
  student_count INT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_layered_exam_layer_pct UNIQUE (exam_id, layer_code, percentage)
);
CREATE INDEX IF NOT EXISTS idx_layered_thresholds_exam_layer ON biz_layered_thresholds (exam_id, layer_code);

CREATE TABLE IF NOT EXISTS biz_student_trends (
  id BIGSERIAL PRIMARY KEY,
  student_id BIGINT NOT NULL REFERENCES biz_students(id) ON DELETE CASCADE,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  term VARCHAR(20) NOT NULL,
  class_name VARCHAR(20) NOT NULL,
  total_score DECIMAL(6,1),
  class_rank INT,
  layer_rank INT,
  rank_change INT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_student_exam UNIQUE (student_id, exam_id)
);
CREATE INDEX IF NOT EXISTS idx_student_trends_student_term ON biz_student_trends (student_id, term);

CREATE TABLE IF NOT EXISTS biz_score_analysis (
  id BIGSERIAL PRIMARY KEY,
  analysis_id VARCHAR(50) NOT NULL,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  exam_name VARCHAR(100) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  analysis_type VARCHAR(50) NOT NULL,
  analysis_scope VARCHAR(50) NOT NULL,
  analysis_data JSONB NOT NULL,
  created_by BIGINT NOT NULL,
  created_by_name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft',
  CONSTRAINT uk_exam_type_scope UNIQUE (exam_id, analysis_type, analysis_scope)
);
CREATE INDEX IF NOT EXISTS idx_score_analysis_id ON biz_score_analysis (analysis_id);
CREATE INDEX IF NOT EXISTS idx_score_analysis_grade ON biz_score_analysis (grade_level);

CREATE TABLE IF NOT EXISTS biz_analysis_logs (
  id BIGSERIAL PRIMARY KEY,
  analysis_id VARCHAR(50),
  publication_id VARCHAR(50),
  action_type VARCHAR(50) NOT NULL,
  action_by BIGINT NOT NULL,
  action_by_name VARCHAR(50),
  action_by_role VARCHAR(50),
  action_detail JSONB,
  ip_address VARCHAR(50),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_analysis ON biz_analysis_logs (analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_actor ON biz_analysis_logs (action_by);

CREATE TABLE IF NOT EXISTS biz_score_analysis_bundles (
  id BIGSERIAL PRIMARY KEY,
  bundle_id VARCHAR(80) NOT NULL UNIQUE,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  exam_name VARCHAR(120) NOT NULL,
  grade_level VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'ready',
  result_json TEXT NOT NULL,
  source_hash VARCHAR(80),
  generated_by BIGINT,
  generated_by_name VARCHAR(80),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_exam_grade_bundle UNIQUE (exam_id, grade_level)
);
CREATE INDEX IF NOT EXISTS idx_bundle_grade_generated ON biz_score_analysis_bundles (grade_level, generated_at);

CREATE TABLE IF NOT EXISTS sys_score_visibility_settings (
  role_code VARCHAR(50) PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS biz_absence_records (
  id BIGSERIAL PRIMARY KEY,
  exam_id BIGINT NOT NULL REFERENCES biz_exams(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES biz_students(id),
  student_code VARCHAR(50) NOT NULL,
  student_name VARCHAR(50) NOT NULL,
  class_id BIGINT,
  class_name VARCHAR(20),
  absent_subjects JSONB,
  reason_type VARCHAR(20) DEFAULT '其他',
  reason_detail VARCHAR(255),
  report_source VARCHAR(20) DEFAULT '教务处',
  reported_by BIGINT REFERENCES sys_users(id),
  reported_by_name VARCHAR(50),
  report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT '待审核',
  audit_by BIGINT REFERENCES sys_users(id),
  audit_by_name VARCHAR(50),
  audit_time TIMESTAMP NULL,
  audit_comment VARCHAR(255),
  attachments JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_absence_exam_student UNIQUE (exam_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_absence_exam_class ON biz_absence_records (exam_id, class_name);
CREATE INDEX IF NOT EXISTS idx_absence_status ON biz_absence_records (status);

CREATE TABLE IF NOT EXISTS biz_absence_logs (
  id BIGSERIAL PRIMARY KEY,
  absence_id BIGINT NOT NULL REFERENCES biz_absence_records(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  action_by BIGINT REFERENCES sys_users(id),
  action_by_name VARCHAR(50),
  action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_values JSONB,
  new_values JSONB,
  remark VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_absence_logs_absence ON biz_absence_logs (absence_id);

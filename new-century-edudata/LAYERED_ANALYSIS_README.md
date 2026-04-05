# 🎓 分层成绩分析系统

## 系统概述

这是一个功能完整的成绩分析分层体系系统，支持全年级范围分析、分层维度统计、分层推送等核心功能。

## 核心功能

### 1. 分层分析体系建设 ✅
- ✅ 实现全年级范围的整体成绩分析功能
- ✅ 建立完善的分层分析机制（A/B/C三层）
- ✅ 各学科临界分计算与分数段统计支持分层维度展示
- ✅ 各层次数据清晰区分、独立呈现

### 2. 分层推送机制开发 ✅
- ✅ 基于层次的成绩推送系统
- ✅ 成绩数据按层次精准推送至对应教师（含班主任）
- ✅ 家长端分层成绩推送功能
- ✅ 推送权限控制机制，保障数据安全性和私密性

### 3. 权限控制体系 ✅
- ✅ 10 色 RBAC 权限体系
- ✅ 分层数据隔离
- ✅ 家长只能查看其子女所属层次的成绩
- ✅ 教师/班主任只能查看负责班级所在层次的数据

## 技术架构

### 后端技术栈
- **框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: MySQL
- **数据处理**: Pandas + NumPy
- **认证**: JWT

### 前端技术栈
- **框架**: React
- **图表**: Recharts
- **UI**: Tailwind CSS
- **图标**: Lucide React

## 文件结构

```
new-century-edudata/
├── backend/
│   ├── routers/
│   │   └── layered_analysis_api.py      # 分层分析 API 路由
│   └── services/
│       └── layered_analysis_service.py  # 分层分析核心服务
├── frontend/
│   └── src/
│       └── components/
│           └── LayeredScoreAnalysis.jsx # 分层分析前端组件
├── database/
│   └── add_layered_analysis.sql         # 数据库扩展脚本
└── demo_layered_analysis.py             # 演示脚本
```

## 数据库表结构

### 核心表

1. **biz_layer_definitions** - 分层定义配置表
   - 存储 ALL/A/B/C 四个层次的定义

2. **biz_exam_layer_configs** - 考试分层配置表
   - 配置每次考试的层次划分

3. **biz_layered_statistics** - 分层成绩统计结果表
   - 存储各层次各学科的统计数据

4. **biz_layered_thresholds** - 分层临界分计算结果表
   - 存储各层次不同百分比的临界分

5. **biz_layered_notifications** - 分层推送记录表
   - 记录分层推送的发送历史

6. **biz_user_layer_permissions** - 用户分层权限表
   - 控制用户对不同层次的访问权限

7. **biz_parent_student_layer** - 家长学生分层关联表
   - 关联家长和学生所在的层次

## API 端点

### 基础信息
```
GET /api/v1/layered-analysis/layers/definitions
```
获取分层定义列表

### 统计分析
```
POST /api/v1/layered-analysis/statistics/calculate
POST /api/v1/layered-analysis/statistics/calculate-all
GET /api/v1/layered-analysis/statistics/query
```

### 临界分
```
POST /api/v1/layered-analysis/thresholds/calculate
GET /api/v1/layered-analysis/thresholds/query
```

### 全年级分析
```
POST /api/v1/layered-analysis/grade-range/analysis
GET /api/v1/layered-analysis/layer-comparison
```

### 分层推送
```
POST /api/v1/layered-analysis/push/create
GET /api/v1/layered-analysis/push/teachers
GET /api/v1/layered-analysis/push/parents
GET /api/v1/layered-analysis/push/notifications
```

### 权限控制
```
GET /api/v1/layered-analysis/permissions/check
GET /api/v1/layered-analysis/permissions/my-layers
```

### 日志
```
GET /api/v1/layered-analysis/logs
```

## 部署步骤

### 1. 执行数据库脚本
```bash
mysql -u root -p new_century_edudata < database/add_layered_analysis.sql
```

### 2. 启动后端服务
```bash
cd backend
python3 main.py
```

后端服务将在 http://localhost:8000 启动

### 3. 访问 API 文档
打开浏览器访问：http://localhost:8000/api/docs

### 4. 运行演示脚本（可选）
```bash
python3 demo_layered_analysis.py
```

## 使用示例

### 计算全年级统计
```python
from services.layered_analysis_service import LayeredAnalysisService

service = LayeredAnalysisService(db)
stats = service.calculate_layer_statistics(
    exam_id=1,
    layer_code='ALL',
    subject_name='total'
)

print(f"平均分：{stats.mean_score}")
print(f"及格率：{stats.pass_rate}%")
```

### 计算分层临界分
```python
thresholds = service.calculate_layer_thresholds(
    exam_id=1,
    layer_code='A',
    percentages=[0.20, 0.40, 0.60, 0.80]
)

for t in thresholds:
    print(f"前{int(t.percentage*100)}%: 总分临界分={t.threshold_total}")
```

### 创建分层推送
```python
from services.layered_analysis_service import LayeredPushService

push_service = LayeredPushService(db)

notification_id = push_service.create_layered_notification(
    exam_id=1,
    layer_code='A',
    title='A 层成绩分析',
    content='本次考试 A 层整体表现优秀...',
    notification_type='teacher',
    target_role='headmaster',
    created_by=1
)

push_service.send_notification(notification_id)
```

## 核心算法

### 班级 Z 值计算（50-20-30 加权）
```
Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)

其中:
- Score_standard = (Class_mean - Layer_mean) / Layer_std
- Top20%_ratio = 班级进入分层前 20% 的人数 / 班级总人数
- Top80%_ratio = 班级进入分层前 80% 的人数 / 班级总人数
```

### 临界分反算
基于总分划定的前 N% 人群，反向计算该人群在各单科的最低下限分

## 系统特色

1. **分层逻辑清晰**
   - 支持全年级 (ALL) 和 A/B/C 三个层次
   - 层次定义可配置、可扩展

2. **数据计算准确**
   - 基于 Pandas 的高效统计算法
   - 支持大规模数据处理

3. **权限控制严格**
   - 基于 RBAC 的分层数据隔离
   - 细粒度的权限控制

4. **推送精准**
   - 按层次精准推送至教师和家长
   - 支持多种推送类型和目标角色

## 后续开发规范

所有新增的成绩分析子版块在设计与开发阶段必须：
- ✅ 纳入分层分析需求
- ✅ 预留分层数据接口
- ✅ 确保与现有分层体系无缝对接
- ✅ 支持分层维度的灵活切换与独立呈现

## 技术支持

- API 文档：http://localhost:8000/api/docs
- 演示脚本：`python3 demo_layered_analysis.py`

## 版本信息

- 版本：1.0.0
- 创建日期：2026-03-03
- 适用学校：瑞安市新纪元实验学校

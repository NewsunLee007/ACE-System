# 新纪元教务大数据平台

瑞安市新纪元实验学校 - 初中教务协同与精准学情分析平台

## 项目概述

本系统专为私立初中教务管理量身定制，融合了**"班级Z值（50-20-30）精准考核模型"**、**"动态行政班分层横向对比机制"**以及**"薄弱学科靶向追踪"**。

### 核心特性

- **班级Z值计算模型**: 50-20-30加权公式，综合评估班级整体水平、优秀生比例和中坚生比例
- **灵活分层对比**: 支持自定义对比层级（如A层、B层），计算完全隔离
- **教师解绑设计**: 成绩不直接绑定教师，支持接班/代课历史追溯
- **十色RBAC权限**: 细粒度权限控制，覆盖教务主任到家长的10级角色
- **统计排除机制**: 缺考/缓考学生可标记不参与统计
- **薄弱学科追踪**: 重点监控英语等薄弱学科的提升效果

## 技术栈

- **后端**: Python 3.10+ / FastAPI / SQLAlchemy
- **数据库**: 本地支持 MySQL/MariaDB，生产支持 Neon PostgreSQL
- **数据处理**: Pandas / NumPy
- **前端**: React 18 / TailwindCSS / Recharts
- **部署**: Docker / Nginx

## 项目结构

```
new-century-edudata/
├── database/
│   └── new_century_schema.sql          # 数据库建表脚本
├── backend/
│   ├── core/
│   │   └── database.py                 # 数据库配置
│   ├── models/                         # 数据模型
│   ├── routers/
│   │   ├── dashboard_api.py            # 教务处看板API
│   │   ├── class_longitudinal_api.py   # 班主任视图API
│   │   ├── parent_query_api.py         # 家长端H5 API
│   │   └── data_import_api.py          # 数据导入导出API
│   ├── services/
│   │   ├── score_analysis_service.py   # 核心算法引擎
│   │   └── data_import_service.py      # 数据导入服务
│   ├── main.py                         # FastAPI入口
│   └── requirements.txt                # Python依赖
└── frontend/                           # React前端
    ├── src/
    │   ├── components/
    │   │   ├── Dashboard.jsx           # 教务处看板
    │   │   └── HeadTeacherView.jsx     # 班主任视图
    │   └── App.jsx
    └── package.json
```

## 核心算法

### 班级Z值计算公式

```
Z_class = (Score_standard × 50%) + (Top20%_ratio × 20%) + (Top80%_ratio × 30%)

其中:
- Score_standard = (Class_mean - Layer_mean) / Layer_std
- Top20%_ratio = 班级进入分层前20%的人数 / 班级总人数
- Top80%_ratio = 班级进入分层前80%的人数 / 班级总人数
```

### 权重说明

- **50%** - 班级标准分（整体水平）
- **20%** - 前20%贡献率（优秀生比例）
- **30%** - 前80%贡献率（中坚生比例）

## 快速开始

### 1. 环境准备

```bash
# 安装 MariaDB 11.x
# 创建数据库
create database new_century_edudata character set utf8mb4 collate utf8mb4_unicode_ci;
```

### 2. 数据库初始化

```bash
cd database
mysql -u root -p new_century_edudata < new_century_schema.sql
```

生产部署到 Neon 时使用 PostgreSQL 初始化脚本：

```bash
psql "$DATABASE_URL" -f database/neon_postgres_schema.sql
```

如果要把当前系统内置的真实演示数据同步到 Neon：

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
export SEED_DEFAULT_PASSWORD="请改成临时强密码"
python scripts/seed_neon_demo_data.py --with-schema
```

同步后用线上链路验证脚本确认教务主任、家长账号和家长学情报告都可用：

```bash
ACE_BASE_URL="https://ace-system-sandy.vercel.app" \
ACE_DEAN_PASSWORD="$SEED_DEFAULT_PASSWORD" \
ACE_PARENT_PASSWORD="$SEED_DEFAULT_PASSWORD" \
python scripts/verify_deployment_readiness.py
```

### 3. 后端部署

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
export DATABASE_URL="mysql+pymysql://root:password@localhost:3306/new_century_edudata?charset=utf8mb4"

# 启动服务
python main.py
```

后端服务将在 `http://localhost:8000` 启动，API文档访问 `http://localhost:8000/api/docs`

### 4. 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

前端服务将在 `http://localhost:3000` 启动

## API接口列表

### 教务处看板
- `GET /api/v1/analysis/exams/{exam_id}/layers/{layer_id}/dashboard` - 看板完整数据
- `GET /api/v1/analysis/exams/{exam_id}/layers/{layer_id}/z-values` - 班级Z值排名
- `GET /api/v1/analysis/exams/{exam_id}/layers/{layer_id}/thresholds` - 学科有效分
- `POST /api/v1/analysis/exams/{exam_id}/layers/{layer_id}/recalculate-z-values` - 重新计算Z值

### 班主任视图
- `GET /api/v1/analysis/classes/{class_name}/longitudinal` - 班级历史趋势
- `GET /api/v1/analysis/classes/{class_name}/student-rank-changes` - 学生进退步
- `GET /api/v1/analysis/classes/{class_name}/weak-subject-trend` - 薄弱学科追踪
- `GET /api/v1/analysis/classes/{class_name}/exam/{exam_id}/detail` - 考试详情

### 家长端H5
- `POST /api/v1/parents/auth` - 双重鉴权
- `GET /api/v1/parents/student/{student_id}/report` - 学情报告
- `GET /api/v1/parents/student/{student_id}/exams` - 历史考试列表

### 数据导入导出
- `POST /api/v1/data/import/scores/{exam_id}` - 导入成绩
- `POST /api/v1/data/import/students` - 导入学籍
- `POST /api/v1/data/layers/create` - 创建分层
- `GET /api/v1/data/export/scores/{exam_id}` - 导出成绩
- `GET /api/v1/data/export/z-values/{exam_id}/{layer_id}` - 导出Z值
- `GET /api/v1/data/export/thresholds/{exam_id}/{layer_id}` - 导出有效分

## 数据导入格式

### 成绩导入模板 (Excel/CSV)

| 学籍辅号 | 姓名 | 班级 | 考号 | 语文 | 数学 | 英语 | 科学 | 社会 | 总分 | 参与统计 | 备注 |
|---------|------|------|------|------|------|------|------|------|------|---------|------|
| 2024010101 | 张三 | 701 | 001 | 85 | 90 | 78 | 88 | 82 | 423 | 是 | |
| 2024010102 | 李四 | 701 | 002 | 82 | 85 | 80 | 85 | 80 | 412 | 是 | |

### 学籍导入模板

| 学籍辅号 | 姓名 | 性别 | 入学年份 | 当前年级 | 当前班级 | 身份证号后6位 |
|---------|------|------|---------|---------|---------|-------------|
| 2024010101 | 张三 | 男 | 2024 | 7年级 | 701 | 123456 |
| 2024010102 | 李四 | 女 | 2024 | 7年级 | 701 | 654321 |

## 系统配置

### 环境变量

```bash
# 数据库配置
# 本地 MySQL/MariaDB
DATABASE_URL=mysql+pymysql://user:password@host:port/database?charset=utf8mb4

# Vercel + Neon PostgreSQL
# DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require

# 应用配置
APP_NAME=新纪元教务大数据平台
APP_VERSION=1.0.0
DEBUG=false

# 安全配置
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 数据库连接池配置

```python
# backend/core/database.py
engine = create_engine(
    DATABASE_URL,
    pool_size=10,           # 连接池大小
    max_overflow=20,        # 最大溢出连接
    pool_pre_ping=True,     # 连接前ping检测
    pool_recycle=3600,      # 连接回收时间
)
```

## 部署指南

### Vercel + Neon 部署

1. 在 Neon 创建数据库，复制 `DATABASE_URL`，并先执行 `database/neon_postgres_schema.sql`。
   - 需要导入当前真实演示数据时，可执行 `python scripts/seed_neon_demo_data.py --with-schema`。
2. 在 Vercel 项目环境变量中配置：
   - `DATABASE_URL`
   - `SECRET_KEY`
   - 可选 AI 配置：`DEEPSEEK_API_KEY`、`DEEPSEEK_API_BASE_URL`、`DEEPSEEK_MODEL`
3. 仓库根目录已经提供 `vercel.json`，会把 `/api/*` 路由到 FastAPI，把其他页面路由到 React 构建产物。
4. 通过 GitHub 集成或 `vercel deploy` 发布；本地 CLI 需要先执行 `vercel login`。

已提供发布辅助脚本，适合在 GitHub 与 Vercel 都登录后执行：

```bash
cd "/Users/newsunsmac/Downloads/ACE System"
VERCEL_SCOPE="newsun-lees-projects" \
VERCEL_PROJECT="ace-system" \
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require" \
SECRET_KEY="change-me-to-a-long-random-string" \
VERCEL_TOKEN="vercel-token-if-not-logged-in" \
SEED_NEON=1 \
CREATE_VERCEL_PROJECT=1 \
SYNC_VERCEL_ENV=1 \
DEPLOY_PROD=1 \
VERIFY_DEPLOYMENT=1 \
./new-century-edudata/scripts/publish_github_vercel_neon.sh
```

其中 `VERCEL_TOKEN` 可选；如果本机已经通过 `npx vercel login`
登录，可以不传。`SYNC_VERCEL_ENV=1` 会把 `DATABASE_URL`、`SECRET_KEY`
以及可选的 `DEEPSEEK_*` 配置写入 Vercel 的 production、preview 和
development 环境；如果变量已存在，需要先在 Vercel 控制台删除旧值再重新同步。
`VERIFY_DEPLOYMENT=1` 会在发布后自动检查 `/health`、`/api/ready`、教务主任
登录、家长账号登录、家长学生绑定和学生报告链路。生产默认地址为
`https://ace-system-sandy.vercel.app`，如需验证预览地址可额外传入
`ACE_BASE_URL="https://preview-url.vercel.app"`。

当前后端已对核心教务链路的 PostgreSQL 方言做兼容：家长绑定、班级/学科/角色/教师职务管理、成绩导入、成绩分析结果包、分层统计缓存和排名可见性设置。

### Docker部署

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: mariadb:11.4
    environment:
      MARIADB_ROOT_PASSWORD: password
      MARIADB_DATABASE: new_century_edudata
    volumes:
      - mariadb_data:/var/lib/mysql
      - ./database/new_century_schema.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "3306:3306"

  backend:
    build: .
    environment:
      DATABASE_URL: mysql+pymysql://root:password@db:3306/new_century_edudata?charset=utf8mb4
    ports:
      - "8000:8000"
    depends_on:
      - db

  frontend:
    image: nginx:alpine
    volumes:
      - ./frontend/build:/usr/share/nginx/html
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mariadb_data:
```

### 生产环境部署步骤

1. **准备服务器**
   ```bash
   # 安装Docker和Docker Compose
   curl -fsSL https://get.docker.com | sh
   ```

2. **克隆代码**
   ```bash
   git clone <repository-url>
   cd new-century-edudata
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **初始化数据**
   ```bash
   # 导入基础数据
   docker-compose exec backend python -c "from core.database import init_db; init_db()"
   ```

## 使用指南

### 1. 初始化系统

1. 导入学生学籍数据
2. 创建考试记录
3. 导入成绩数据
4. 创建班级分层
5. 计算Z值排名

### 2. 日常使用流程

1. **考试前**: 创建考试记录，设置分层
2. **考试后**: 导入成绩数据
3. **数据分析**: 查看Z值排名、有效分、薄弱学科
4. **家长查询**: 家长通过H5页面查询学生成绩

### 3. 分层对比示例

```
7年级18个班级:
- A层: 701-710班 (前10个班对比)
- B层: 701-712班 (前12个班对比)
- 全段: 701-718班 (全部班级对比)
```

## 常见问题

### Q: Z值计算为负数是什么意思？
A: Z值为负表示班级平均分低于分层平均分，需要关注改进。

### Q: 如何标记学生不参与统计？
A: 在成绩导入时，将"参与统计"列设为"否"，或备注中注明"缺考"/"缓考"。

### Q: 教师中途接班如何处理？
A: 在`biz_teacher_class_rel`表中添加新的任课记录，历史成绩会自动关联到班级而非教师个人。

### Q: 家长如何查询成绩？
A: 家长需要输入：班级 + 学生姓名 + 学籍辅号后6位（或身份证后6位）进行双重鉴权。

## 维护与支持

### 日志位置
```
backend/logs/app.log
```

### 数据库备份
```bash
mariadb-dump -u root -p new_century_edudata > backup_$(date +%Y%m%d).sql
```

### 性能优化建议
1. 定期清理历史Z值缓存表
2. 为频繁查询的列添加索引
3. 使用Redis缓存热点数据

## 更新日志

### v1.0.0 (2025-02)
- 初始版本发布
- 实现核心Z值计算模型
- 完成10色RBAC权限体系
- 支持成绩导入导出
- 家长端H5查询功能

## 许可证

本项目仅供瑞安市新纪元实验学校内部使用。

## 联系方式

- **技术支持**: 学校信息中心
- **业务咨询**: 教务处

---

**瑞安市新纪元实验学校 © 2025 All Rights Reserved**

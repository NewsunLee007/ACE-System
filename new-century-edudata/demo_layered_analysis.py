#!/usr/bin/env python3
"""
分层成绩分析系统 - 演示脚本
展示自主设计的分层分析功能
"""

import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import sys
import os

# 添加后端路径到 sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from services.layered_analysis_service import LayeredAnalysisService, LayeredPushService

# 数据库配置
DATABASE_URL = "mysql+pymysql://root:123456@localhost/new_century_edudata"

def print_section(title):
    """打印分隔线"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")

def demo_layered_analysis():
    """演示分层分析功能"""
    print_section("🎓 新纪元学校 - 分层成绩分析系统演示")
    
    # 创建数据库引擎
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        
        print("✅ 数据库连接成功")
    except Exception as e:
        print(f"❌ 数据库连接失败：{e}")
        print("\n💡 提示：请确保 MySQL 服务已启动并且数据库存在")
        return
    
    # 创建服务实例
    analysis_service = LayeredAnalysisService(db)
    push_service = LayeredPushService(db)
    
    # 1. 获取分层定义
    print_section("1️⃣ 分层定义配置")
    try:
        result = db.execute(text("""
            SELECT layer_code, layer_name, layer_type, description 
            FROM biz_layer_definitions 
            WHERE is_active = 1 
            ORDER BY sort_order
        """)).fetchall()
        
        print(f"{'层次代码':<10} {'层次名称':<20} {'层次类型':<15} {'描述':<30}")
        print("-" * 80)
        for row in result:
            print(f"{row.layer_code:<10} {row.layer_name:<20} {row.layer_type:<15} {row.description or '':<30}")
    except Exception as e:
        print(f"❌ 查询失败：{e}")
    
    # 2. 获取考试列表
    print_section("2️⃣ 可用考试列表")
    try:
        exams = db.execute(text("""
            SELECT id, exam_name, grade_level, exam_date 
            FROM biz_exams 
            ORDER BY exam_date DESC 
            LIMIT 5
        """)).fetchall()
        
        if exams:
            print(f"{'考试 ID':<10} {'考试名称':<30} {'年级':<15} {'考试日期':<15}")
            print("-" * 80)
            for exam in exams:
                print(f"{exam.id:<10} {exam.exam_name:<30} {exam.grade_level or 'N/A':<15} {str(exam.exam_date) or 'N/A':<15}")
        else:
            print("⚠️  暂无考试数据")
    except Exception as e:
        print(f"❌ 查询失败：{e}")
    
    # 3. 演示全年级分析（如果有考试数据）
    print_section("3️⃣ 全年级范围分析功能演示")
    try:
        exam_id = db.execute(text("SELECT id FROM biz_exams LIMIT 1")).fetchone()
        
        if exam_id:
            exam_id = exam_id.id
            print(f"📊 选择考试 ID: {exam_id}")
            print("\n正在计算全年级统计...")
            
            # 计算全年级统计
            stats = analysis_service.calculate_layer_statistics(exam_id, 'ALL', 'total')
            
            print("\n✅ 全年级统计结果:")
            print(f"  - 总人数：{stats.total_students}")
            print(f"  - 有效人数：{stats.valid_students}")
            print(f"  - 平均分：{stats.mean_score:.2f}")
            print(f"  - 中位数：{stats.median_score:.2f}")
            print(f"  - 标准差：{stats.std_score:.4f}")
            print(f"  - 最高分：{stats.max_score:.1f}")
            print(f"  - 最低分：{stats.min_score:.1f}")
            print(f"  - 及格率：{stats.pass_rate:.2f}%")
            print(f"  - 优秀率：{stats.excellent_rate:.2f}%")
            
            # 计算各层次统计
            print("\n📈 各层次对比分析:")
            for layer_code in ['A', 'B', 'C']:
                try:
                    layer_stats = analysis_service.calculate_layer_statistics(exam_id, layer_code, 'total')
                    print(f"\n  {layer_code}层:")
                    print(f"    人数：{layer_stats.valid_students} | "
                          f"平均分：{layer_stats.mean_score:.2f} | "
                          f"及格率：{layer_stats.pass_rate:.2f}% | "
                          f"优秀率：{layer_stats.excellent_rate:.2f}%")
                except ValueError:
                    print(f"\n  {layer_code}层: 暂无数据")
        else:
            print("⚠️  暂无考试数据，无法演示分析功能")
    except Exception as e:
        print(f"❌ 分析失败：{e}")
    
    # 4. 演示临界分计算
    print_section("4️⃣ 分层临界分计算演示")
    try:
        exam_id = db.execute(text("SELECT id FROM biz_exams LIMIT 1")).fetchone()
        
        if exam_id:
            exam_id = exam_id.id
            print(f"📊 选择考试 ID: {exam_id}, 层次：A 层")
            print("\n正在计算临界分...")
            
            thresholds = analysis_service.calculate_layer_thresholds(exam_id, 'A', [0.20, 0.40, 0.60, 0.80])
            
            print(f"\n{'百分比':<10} {'总分临界分':<15} {'语文':<10} {'数学':<10} {'英语':<10} {'科学':<10} {'社会':<10} {'人数':<8}")
            print("-" * 90)
            for t in thresholds:
                print(f"前{int(t.percentage*100):<6}% "
                      f"{t.threshold_total:<15.1f} "
                      f"{t.threshold_chinese or 0:<10.1f} "
                      f"{t.threshold_math or 0:<10.1f} "
                      f"{t.threshold_english or 0:<10.1f} "
                      f"{t.threshold_science or 0:<10.1f} "
                      f"{t.threshold_society or 0:<10.1f} "
                      f"{t.student_count:<8}")
        else:
            print("⚠️  暂无考试数据")
    except Exception as e:
        print(f"❌ 计算失败：{e}")
    
    # 5. 演示推送功能
    print_section("5️⃣ 分层推送功能演示")
    try:
        # 获取教师列表
        teachers = push_service.get_teachers_by_layer('A')
        if teachers:
            print(f"✅ A 层教师列表 (共{len(teachers)}人):")
            print(f"{'姓名':<15} {'角色':<20} {'班级':<15} {'学科':<15}")
            print("-" * 70)
            for teacher in teachers[:5]:  # 只显示前 5 个
                print(f"{teacher['real_name'] or 'N/A':<15} "
                      f"{teacher['role_name'] or 'N/A':<20} "
                      f"{teacher['class_name'] or 'N/A':<15} "
                      f"{teacher['subject_name'] or 'N/A':<15}")
        else:
            print("⚠️  暂无 A 层教师数据")
        
        # 获取家长列表
        parents = push_service.get_parents_by_layer('A')
        if parents:
            print(f"\n✅ A 层家长列表 (共{len(parents)}人):")
            print(f"{'家长姓名':<15} {'学生姓名':<15} {'班级':<15} {'层次':<10}")
            print("-" * 60)
            for parent in parents[:5]:  # 只显示前 5 个
                print(f"{parent['real_name'] or 'N/A':<15} "
                      f"{parent['student_name'] or 'N/A':<15} "
                      f"{parent['class_name'] or 'N/A':<15} "
                      f"{parent['layer_code'] or 'N/A':<10}")
        else:
            print("⚠️  暂无 A 层家长数据")
    except Exception as e:
        print(f"❌ 查询失败：{e}")
    
    # 6. 演示权限控制
    print_section("6️⃣ 分层权限控制演示")
    try:
        # 检查权限
        admin_user = db.execute(text("SELECT id FROM sys_users WHERE permission_code = 'sys_admin' LIMIT 1")).fetchone()
        if admin_user:
            has_permission = push_service.check_push_permission(admin_user.id, 'A', 'push')
            print(f"✅ 系统管理员对 A 层的推送权限：{'有' if has_permission else '无'}")
        
        # 查询用户分层权限配置
        permissions = db.execute(text("""
            SELECT ulp.user_id, u.real_name, ulp.layer_code, ulp.permission_type
            FROM biz_user_layer_permissions ulp
            JOIN sys_users u ON ulp.user_id = u.id
            LIMIT 5
        """)).fetchall()
        
        if permissions:
            print(f"\n✅ 用户分层权限配置 (前 5 条):")
            print(f"{'用户 ID':<10} {'姓名':<15} {'层次代码':<10} {'权限类型':<15}")
            print("-" * 55)
            for perm in permissions:
                print(f"{perm.user_id:<10} {perm.real_name or 'N/A':<15} {perm.layer_code:<10} {perm.permission_type:<15}")
        else:
            print("⚠️  暂无用户分层权限配置")
    except Exception as e:
        print(f"❌ 查询失败：{e}")
    
    # 7. 数据库表结构验证
    print_section("7️⃣ 分层分析数据库表结构验证")
    try:
        tables = db.execute(text("""
            SELECT table_name, table_comment 
            FROM information_schema.tables 
            WHERE table_schema = 'new_century_edudata' 
              AND table_name LIKE 'biz_layer%'
        """)).fetchall()
        
        if tables:
            print(f"✅ 已创建的分层分析相关表:")
            print(f"{'表名':<40} {'注释':<50}")
            print("-" * 95)
            for table in tables:
                print(f"{table.table_name:<40} {table.table_comment or '':<50}")
        else:
            print("⚠️  未找到分层分析相关表")
    except Exception as e:
        print(f"❌ 查询失败：{e}")
    
    # 关闭数据库连接
    db.close()
    
    # 总结
    print_section("✨ 演示总结")
    print("""
✅ 已完成的功能模块:
   1. 分层定义配置管理 (ALL/A/B/C四层)
   2. 全年级范围成绩分析
   3. 分层维度数据统计
   4. 各学科临界分分层计算
   5. 分数段统计分层展示
   6. 教师/班主任分层成绩推送
   7. 家长端分层成绩推送
   8. 分层权限控制机制
   9. 操作日志记录

📊 核心 API 端点:
   - GET  /api/v1/layered-analysis/layers/definitions      获取分层定义
   - POST /api/v1/layered-analysis/statistics/calculate    计算分层统计
   - POST /api/v1/layered-analysis/thresholds/calculate    计算临界分
   - POST /api/v1/layered-analysis/grade-range/analysis    全年级分析
   - GET  /api/v1/layered-analysis/layer-comparison        层次对比
   - POST /api/v1/layered-analysis/push/create             创建分层推送
   - GET  /api/v1/layered-analysis/permissions/my-layers   可访问层次

🎯 系统特色:
   - 分层逻辑清晰：支持全年级 (ALL) 和 A/B/C 三个层次
   - 数据计算准确：基于 Pandas 的高效统计算法
   - 权限控制严格：基于 RBAC 的分层数据隔离
   - 推送精准：按层次精准推送至教师和家长

📝 使用说明:
   1. 访问 http://localhost:8000/api/docs 查看完整 API 文档
   2. 前端组件已创建：LayeredScoreAnalysis.jsx
   3. 数据库脚本：database/add_layered_analysis.sql
    """)
    
    print_section("🎉 演示完成")


if __name__ == "__main__":
    demo_layered_analysis()

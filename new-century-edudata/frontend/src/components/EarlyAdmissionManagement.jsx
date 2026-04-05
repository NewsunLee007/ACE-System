import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  GraduationCap,
  School,
  Calendar,
  Download,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Building2
} from 'lucide-react';
import schoolData from '../data/schoolData';

const EarlyAdmissionManagement = () => {
  const [students, setStudents] = useState([]);
  const [earlyAdmissions, setEarlyAdmissions] = useState([]);
  const [schools, setSchools] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  
  // 表单数据
  const [formData, setFormData] = useState({
    student_id: '',
    school_name: '',
    admission_date: '',
    admission_type: '保送', // 保送、特招、签约等
    notes: ''
  });

  // 加载数据
  useEffect(() => {
    setStudents(schoolData.students || []);
    setEarlyAdmissions(schoolData.earlyAdmissions || []);
    setSchools(schoolData.earlyAdmissionSchools || ['温中', '瑞中', '新纪元']);
  }, []);

  // 保存提前招生学校列表
  const saveSchools = (updatedSchools) => {
    setSchools(updatedSchools);
    schoolData.earlyAdmissionSchools = updatedSchools;
  };

  // 添加学校
  const handleAddSchool = () => {
    if (!newSchoolName.trim()) {
      alert('请输入学校名称');
      return;
    }
    if (schools.includes(newSchoolName.trim())) {
      alert('该学校已存在');
      return;
    }
    const updatedSchools = [...schools, newSchoolName.trim()];
    saveSchools(updatedSchools);
    setNewSchoolName('');
    alert('添加成功');
  };

  // 删除学校
  const handleDeleteSchool = (schoolName) => {
    // 检查是否有学生被该学校录取
    const hasStudents = earlyAdmissions.some(a => a.school_name === schoolName);
    if (hasStudents) {
      alert('无法删除，已有学生被该学校录取');
      return;
    }
    if (window.confirm(`确定要删除学校 "${schoolName}" 吗？`)) {
      const updatedSchools = schools.filter(s => s !== schoolName);
      saveSchools(updatedSchools);
    }
  };

  // 获取已提前招生的学生ID列表
  const getAdmittedStudentIds = () => {
    return earlyAdmissions.map(a => a.student_id);
  };

  // 获取学生信息
  const getStudentInfo = (studentId) => {
    return students.find(s => s.id === studentId);
  };

  // 获取提前招生记录
  const getStudentAdmission = (studentId) => {
    return earlyAdmissions.find(a => a.student_id === studentId);
  };

  // 获取所有唯一的年级
  const uniqueGrades = React.useMemo(() => {
    const gradeSet = new Set();
    students.forEach(student => {
      const cls = schoolData.classes.find(c => c.id === student.class_id);
      if (cls) {
        const grade = Math.floor(cls.id / 100);
        if (grade >= 7 && grade <= 9) {
          gradeSet.add(String(grade));
        }
      }
    });
    return Array.from(gradeSet).sort();
  }, [students]);

  // 获取所有唯一的班级（根据选中的年级过滤）
  const uniqueClasses = React.useMemo(() => {
    const classMap = new Map();
    students.forEach(student => {
      const cls = schoolData.classes.find(c => c.id === student.class_id);
      if (cls) {
        if (filterGrade) {
          const classGrade = String(Math.floor(cls.id / 100));
          if (classGrade === filterGrade) {
            classMap.set(cls.id, cls);
          }
        } else {
          classMap.set(cls.id, cls);
        }
      }
    });
    return Array.from(classMap.values()).sort((a, b) => a.id - b.id);
  }, [students, filterGrade]);

  // 筛选提前招生学生
  const filteredAdmissions = earlyAdmissions.filter(admission => {
    const student = getStudentInfo(admission.student_id);
    if (!student) return false;
    
    const matchSearch = student.name.includes(searchTerm) || student.student_code.includes(searchTerm);
    const matchGrade = !filterGrade || (() => {
      const cls = schoolData.classes.find(c => c.id === student.class_id);
      return cls && String(Math.floor(cls.id / 100)) === filterGrade;
    })();
    const matchClass = !filterClass || student.class_id === parseInt(filterClass);
    const matchSchool = !filterSchool || admission.school_name === filterSchool;
    
    return matchSearch && matchGrade && matchClass && matchSchool;
  });

  // 打开新增弹窗
  const handleAdd = () => {
    setEditingRecord(null);
    setFormData({
      student_id: '',
      school_name: schools[0] || '',
      admission_date: new Date().toISOString().split('T')[0],
      admission_type: '保送',
      notes: ''
    });
    setShowModal(true);
  };

  // 打开编辑弹窗
  const handleEdit = (admission) => {
    setEditingRecord(admission);
    setFormData({
      student_id: admission.student_id,
      school_name: admission.school_name,
      admission_date: admission.admission_date,
      admission_type: admission.admission_type || '保送',
      notes: admission.notes || ''
    });
    setShowModal(true);
  };

  // 保存记录
  const handleSave = () => {
    if (!formData.student_id) {
      alert('请选择学生');
      return;
    }
    if (!formData.school_name) {
      alert('请选择录取学校');
      return;
    }

    // 检查学生是否已被其他学校录取
    const existingAdmission = earlyAdmissions.find(
      a => a.student_id === parseInt(formData.student_id) && (!editingRecord || a.id !== editingRecord.id)
    );
    if (existingAdmission) {
      const student = getStudentInfo(parseInt(formData.student_id));
      alert(`学生 "${student?.name}" 已被 "${existingAdmission.school_name}" 录取，不能重复添加`);
      return;
    }

    if (editingRecord) {
      // 编辑
      const updatedAdmissions = earlyAdmissions.map(a =>
        a.id === editingRecord.id
          ? { ...a, ...formData, student_id: parseInt(formData.student_id) }
          : a
      );
      setEarlyAdmissions(updatedAdmissions);
      schoolData.earlyAdmissions = updatedAdmissions;
    } else {
      // 新增
      const newAdmission = {
        id: Date.now(),
        ...formData,
        student_id: parseInt(formData.student_id),
        created_at: new Date().toISOString().split('T')[0]
      };
      const updatedAdmissions = [...earlyAdmissions, newAdmission];
      setEarlyAdmissions(updatedAdmissions);
      schoolData.earlyAdmissions = updatedAdmissions;
    }

    setShowModal(false);
    alert(editingRecord ? '更新成功' : '添加成功');
  };

  // 删除记录
  const handleDelete = (id) => {
    if (window.confirm('确定要删除这条提前招生记录吗？')) {
      const updatedAdmissions = earlyAdmissions.filter(a => a.id !== id);
      setEarlyAdmissions(updatedAdmissions);
      schoolData.earlyAdmissions = updatedAdmissions;
    }
  };

  // 导出提前招生名单
  const exportEarlyAdmissions = () => {
    const headers = ['学籍辅号', '姓名', '性别', '班级', '录取学校', '录取类型', '录取日期', '备注'];
    const data = filteredAdmissions.map(admission => {
      const student = getStudentInfo(admission.student_id);
      const cls = student ? schoolData.getClassById(student.class_id) : null;
      return [
        student?.student_code || '',
        student?.name || '',
        student?.gender === 1 ? '男' : '女',
        cls ? schoolData.formatClassName(cls.id) : '',
        admission.school_name,
        admission.admission_type,
        admission.admission_date,
        admission.notes || ''
      ];
    });

    const csvContent = [headers.join(','), ...data.map(row => row.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `提前招生名单_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // 统计信息
  const stats = {
    total: earlyAdmissions.length,
    bySchool: {}
  };
  schools.forEach(school => {
    stats.bySchool[school] = earlyAdmissions.filter(a => a.school_name === school).length;
  });

  return (
    <div className="p-6">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">提前招生管理</h1>
        <p className="text-gray-500 mt-1">管理被高中提前招收的学生信息</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-gray-500">提前招生总数</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </div>
        </div>
        {schools.map(school => (
          <div key={school} className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <School className="h-6 w-6" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-500">{school}</p>
                <p className="text-2xl font-bold text-green-600">{stats.bySchool[school] || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索学生姓名或学籍号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
              />
            </div>
            <select
              value={filterGrade}
              onChange={(e) => {
                setFilterGrade(e.target.value);
                setFilterClass('');
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有年级</option>
              {uniqueGrades.map(grade => (
                <option key={grade} value={grade}>
                  {grade === '7' ? '七年级' : grade === '8' ? '八年级' : grade === '9' ? '九年级' : `${grade}年级`}
                </option>
              ))}
            </select>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有班级</option>
              {uniqueClasses.map(cls => (
                <option key={cls.id} value={cls.id}>
                  {cls.name || `${cls.enrollment_year}级${cls.class_no}班`}
                </option>
              ))}
            </select>
            <select
              value={filterSchool}
              onChange={(e) => setFilterSchool(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">所有学校</option>
              {schools.map(school => (
                <option key={school} value={school}>{school}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSchoolModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Building2 className="w-4 h-4" />
              学校管理
            </button>
            <button
              onClick={exportEarlyAdmissions}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              导出名单
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              添加记录
            </button>
          </div>
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">学籍辅号</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">姓名</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">性别</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">班级</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">录取学校</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">录取类型</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">录取日期</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">备注</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAdmissions.length > 0 ? (
              filteredAdmissions.map(admission => {
                const student = getStudentInfo(admission.student_id);
                const cls = student ? schoolData.getClassById(student.class_id) : null;
                return (
                  <tr key={admission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{student?.student_code}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {student?.gender === 1 ? '男' : '女'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {cls ? schoolData.formatClassName(cls.id) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                        {admission.school_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{admission.admission_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{admission.admission_date}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{admission.notes || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(admission)}
                          className="text-blue-600 hover:text-blue-900"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(admission.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>暂无提前招生记录</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 新增/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">
                {editingRecord ? '编辑提前招生记录' : '添加提前招生记录'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择学生</label>
                <select
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  disabled={editingRecord !== null}
                >
                  <option value="">请选择学生</option>
                  {students
                    .filter(s => !getAdmittedStudentIds().includes(s.id) || (editingRecord && editingRecord.student_id === s.id))
                    .map(student => {
                      const cls = schoolData.getClassById(student.class_id);
                      return (
                        <option key={student.id} value={student.id}>
                          {student.name} ({student.student_code}) - {cls ? schoolData.formatClassName(cls.id) : '未分配班级'}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">录取学校</label>
                <select
                  value={formData.school_name}
                  onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {schools.map(school => (
                    <option key={school} value={school}>{school}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">录取类型</label>
                <select
                  value={formData.admission_type}
                  onChange={(e) => setFormData({ ...formData, admission_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="保送">保送</option>
                  <option value="特招">特招</option>
                  <option value="签约">签约</option>
                  <option value="自主招生">自主招生</option>
                  <option value="其他">其他</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">录取日期</label>
                <input
                  type="date"
                  value={formData.admission_date}
                  onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  rows="3"
                  placeholder="可选填"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 学校管理弹窗 */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">提前招生学校管理</h2>
              <button onClick={() => setShowSchoolModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  placeholder="输入学校名称"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  onClick={handleAddSchool}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  添加
                </button>
              </div>

              <div className="border rounded-lg divide-y">
                {schools.map(school => (
                  <div key={school} className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">{school}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteSchool(school);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowSchoolModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                完成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EarlyAdmissionManagement;

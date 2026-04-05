import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function TopStudentsTracking({ examScores, classLayers }) {
  const [topN, setTopN] = useState(50);
  const [filterClass, setFilterClass] = useState('all');

  const { topStudents, distributionData } = useMemo(() => {
    if (!examScores || examScores.length === 0) return { topStudents: [], distributionData: [] };

    // Sort by total_score descending
    const validScores = examScores.filter(s => s.is_valid !== false && Number.isFinite(Number(s.total_score)));
    validScores.sort((a, b) => Number(b.total_score) - Number(a.total_score));

    // Calculate rank and distribution
    const classDist = {};
    const studentsWithRank = validScores.map((s, idx) => {
      const clsLayer = classLayers?.find(l => l.class_id === Number(s.class_id));
      const className = clsLayer ? clsLayer.class_name : String(s.class_id);
      
      const rank = idx + 1;
      const std = { ...s, rank, className };

      if (!classDist[className]) {
        classDist[className] = { top50: 0, top100: 0, top200: 0 };
      }
      if (rank <= 50) classDist[className].top50++;
      if (rank <= 100) classDist[className].top100++;
      if (rank <= 200) classDist[className].top200++;

      return std;
    });

    const distArray = Object.keys(classDist).sort((a, b) => {
      // 提取班级号进行排序
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    }).map(className => ({
      className,
      ...classDist[className]
    }));

    return { topStudents: studentsWithRank.slice(0, 200), distributionData: distArray }; // Max top 200 kept for table filtering
  }, [examScores, classLayers]);

  const filteredStudents = topStudents.filter(s => s.rank <= topN && (filterClass === 'all' || s.className === filterClass));
  const classOptions = Array.from(new Set(topStudents.map(s => s.className))).sort();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">高分段分布对比</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="className" />
                <YAxis />
                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                <Legend />
                <Bar dataKey="top50" name="前50名" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="top100" name="前100名" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="top200" name="前200名" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center font-semibold">班级</TableHead>
                  <TableHead className="text-center font-semibold text-red-600">前50名人数</TableHead>
                  <TableHead className="text-center font-semibold text-amber-600">前100名人数</TableHead>
                  <TableHead className="text-center font-semibold text-blue-600">前200名人数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {distributionData.map(row => (
                  <TableRow key={row.className}>
                    <TableCell className="text-center font-medium">{row.className}</TableCell>
                    <TableCell className="text-center">{row.top50}</TableCell>
                    <TableCell className="text-center">{row.top100}</TableCell>
                    <TableCell className="text-center">{row.top200}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">尖子生追踪明细</CardTitle>
          <div className="flex items-center gap-4">
            <select 
              value={topN} 
              onChange={e => setTopN(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value={50}>前 50 名</option>
              <option value={100}>前 100 名</option>
              <option value={200}>前 200 名</option>
            </select>
            <select 
              value={filterClass} 
              onChange={e => setFilterClass(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="all">所有班级</option>
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                <TableRow>
                  <TableHead className="text-center w-20">年级排名</TableHead>
                  <TableHead className="text-center w-24">考号</TableHead>
                  <TableHead className="text-center w-24">姓名</TableHead>
                  <TableHead className="text-center w-24">班级</TableHead>
                  <TableHead className="text-center w-24">总分</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <TableRow key={student.student_id || student.rank}>
                    <TableCell className="text-center font-bold text-gray-700">{student.rank}</TableCell>
                    <TableCell className="text-center text-gray-500">{student.student_id || '-'}</TableCell>
                    <TableCell className="text-center font-medium">{student.student_name}</TableCell>
                    <TableCell className="text-center">{student.className}</TableCell>
                    <TableCell className="text-center text-blue-600 font-semibold">{student.total_score}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">暂无符合条件的学生数据</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
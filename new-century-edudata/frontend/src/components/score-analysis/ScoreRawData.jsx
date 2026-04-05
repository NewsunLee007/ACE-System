import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

export default function ScoreRawData({ examData, onImportSuccess }) {
  const [pasteData, setPasteData] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [error, setError] = useState('');

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    setPasteData(text);
    parseText(text);
  };

  const parseText = (text) => {
    if (!text) {
      setParsedData([]);
      setError('');
      return;
    }
    try {
      const rows = text.trim().split('\n').map(row => row.split('\t'));
      if (rows.length < 2) throw new Error('数据格式不正确，至少需要表头和一行数据');
      
      const headers = rows[0].map(h => h.trim());
      const data = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i]?.trim();
        });
        return obj;
      });
      setParsedData(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImport = () => {
    if (parsedData.length === 0) return;
    if (onImportSuccess) onImportSuccess(parsedData);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              智能粘贴 (Smart Paste)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                请从 Excel 中复制数据并粘贴到下方文本框中。需包含：考号、姓名、班级、各科原始分、总分。
              </p>
              <textarea
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="在此处粘贴 Excel 数据 (Ctrl+V / Cmd+V)..."
                value={pasteData}
                onChange={(e) => {
                  setPasteData(e.target.value);
                  parseText(e.target.value);
                }}
                onPaste={handlePaste}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="w-5 h-5 text-green-500" />
              文件导入
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                或选择上传 Excel 文件 (.xlsx, .xls)。
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">点击选择文件，或将文件拖拽到此处</p>
                <p className="text-xs text-gray-400 mt-1">支持 .xlsx, .xls 格式</p>
                <input type="file" className="hidden" accept=".xlsx, .xls" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {parsedData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              解析预览 (共 {parsedData.length} 条数据)
            </CardTitle>
            <Button onClick={handleImport} className="bg-blue-600 text-white hover:bg-blue-700">
              确认导入成绩
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    {Object.keys(parsedData[0] || {}).map((h, i) => (
                      <TableHead key={i} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 50).map((row, i) => (
                    <TableRow key={i}>
                      {Object.values(row).map((val, j) => (
                        <TableCell key={j} className="whitespace-nowrap">{val || '-'}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedData.length > 50 && (
                <p className="text-center text-sm text-gray-500 py-4 border-t">
                  仅显示前 50 条数据预览
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
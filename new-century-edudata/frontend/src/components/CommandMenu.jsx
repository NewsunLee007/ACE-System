import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, BookOpen, Settings, Search, X } from 'lucide-react';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform scale-100 transition-all">
        <Command
          className="w-full"
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Backspace' && !e.currentTarget.value)) {
              e.preventDefault();
              setOpen(false);
            }
          }}
        >
          <div className="flex items-center px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <Search className="w-5 h-5 text-slate-400 mr-2" />
            <Command.Input 
              autoFocus 
              placeholder="搜索页面或功能..." 
              className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            <button 
              onClick={() => setOpen(false)}
              className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              未找到结果。
            </Command.Empty>

            <Command.Group heading="常用" className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400 my-2">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/dashboard'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>教务大屏</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/headteacher'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <Users className="w-4 h-4" />
                <span>班主任视图</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />

            <Command.Group heading="教务管理" className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400 my-2">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/educational/classes'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <span>班级管理</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/educational/students'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <span>学生管理</span>
              </Command.Item>
              <Command.Item
                onSelect={() => runCommand(() => navigate('/educational/teachers'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <span>教师管理</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />

            <Command.Group heading="系统" className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400 my-2">
              <Command.Item
                onSelect={() => runCommand(() => navigate('/settings'))}
                className="flex items-center gap-2 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
              >
                <Settings className="w-4 h-4" />
                <span>系统设置</span>
              </Command.Item>
            </Command.Group>

          </Command.List>
        </Command>
      </div>
    </div>
  );
}
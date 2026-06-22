import React, { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { getFlatNavigationForRole, getUserRole } from '../lib/navigation';

const readStoredUser = () => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch (error) {
    return null;
  }
};

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(() => readStoredUser());
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setUser(readStoredUser());
        setOpen((open) => !open);
      }
    };
    const openCommandMenu = () => {
      setUser(readStoredUser());
      setOpen(true);
    };

    document.addEventListener('keydown', down);
    document.addEventListener('ace:open-command-menu', openCommandMenu);

    return () => {
      document.removeEventListener('keydown', down);
      document.removeEventListener('ace:open-command-menu', openCommandMenu);
    };
  }, []);

  const commandGroups = useMemo(() => {
    const entries = getFlatNavigationForRole(getUserRole(user));

    return entries.reduce((groups, item) => {
      const groupLabel = item.groupLabel || '常用入口';
      const existingGroup = groups.find((group) => group.label === groupLabel);
      if (existingGroup) {
        existingGroup.items.push(item);
      } else {
        groups.push({ label: groupLabel, items: [item] });
      }
      return groups;
    }, []);
  }, [user]);

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

            {commandGroups.map((group, groupIndex) => (
              <React.Fragment key={group.label}>
                {groupIndex > 0 && <Command.Separator className="h-px bg-slate-100 dark:bg-slate-800 mx-2 my-1" />}
                <Command.Group heading={group.label} className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400 my-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Command.Item
                        key={item.path}
                        value={`${item.label} ${item.description || ''} ${group.label}`}
                        onSelect={() => runCommand(() => navigate(item.path))}
                        className="flex items-center gap-3 px-2 py-2 mt-1 rounded-md text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 text-slate-700 dark:text-slate-300"
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-800 dark:text-slate-100">{item.label}</span>
                          {item.description && (
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</span>
                          )}
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              </React.Fragment>
            ))}

          </Command.List>
        </Command>
      </div>
    </div>
  );
}

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const cx = (...items) => items.filter(Boolean).join(' ');

const toneClasses = {
  blue: {
    active: 'bg-blue-50 text-blue-900 ring-1 ring-blue-500',
    activeDot: 'bg-blue-600 text-white',
    check: 'text-blue-600',
    hover: 'hover:bg-blue-50',
  },
  purple: {
    active: 'bg-white text-purple-900 ring-1 ring-purple-500',
    activeDot: 'bg-purple-600 text-white',
    check: 'text-purple-600',
    hover: 'hover:bg-white',
  },
  indigo: {
    active: 'bg-white text-indigo-900 ring-1 ring-indigo-500',
    activeDot: 'bg-indigo-600 text-white',
    check: 'text-indigo-600',
    hover: 'hover:bg-indigo-50',
  },
};

export default function FlowModuleSelector({
  title,
  hint,
  modules,
  activeValue,
  onChange,
  tone = 'blue',
  showCurrent = false,
  scrollTargetId,
}) {
  const colors = toneClasses[tone] || toneClasses.blue;
  const activeModule = modules.find(module => module.value === activeValue);
  const handleChange = (nextValue) => {
    onChange(nextValue);
    if (!scrollTargetId) return;

    window.setTimeout(() => {
      const target = document.getElementById(scrollTargetId);
      target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  return (
    <div className="mb-5">
      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
          {showCurrent && (
            <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              当前：{activeModule?.label || '-'}
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="flex flex-col gap-2 xl:flex-row">
          {modules.map((module, index) => {
            const ModuleIcon = module.icon;
            const active = module.value === activeValue;
            const disabled = module.ready === false;

            return (
              <button
                key={module.value}
                type="button"
                onClick={() => !disabled && handleChange(module.value)}
                disabled={disabled}
                className={cx(
                  'flex min-h-16 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                  active ? colors.active : `text-slate-700 ${colors.hover}`,
                  disabled && 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-70'
                )}
              >
                <span className={cx(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  active ? colors.activeDot : disabled ? 'bg-white text-slate-400' : 'bg-slate-100 text-slate-600'
                )}>
                  <ModuleIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{module.desc}</span>
                </span>
                {active && <CheckCircle2 className={cx('h-4 w-4 shrink-0', colors.check)} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Clock, CheckCircle } from 'lucide-react';
import { SchedulerTask } from '@shared/types/ipc';

export const SchedulerPanel: React.FC = () => {
  const [tasks, setTasks] = useState<SchedulerTask[]>([]);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('01:00');
  const [stopTime, setStopTime] = useState('06:00');
  const [action, setAction] = useState<'START_ALL' | 'PAUSE_ALL' | 'SPEED_LIMIT'>('START_ALL');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const list = await window.electronAPI.getSchedulerTasks();
    setTasks(list);
  };

  const handleAddTask = async () => {
    if (!name) return;
    const newTask: SchedulerTask = {
      id: 'task_' + Date.now(),
      name,
      startTime,
      stopTime,
      enabled: true,
      action,
    };
    await window.electronAPI.saveSchedulerTask(newTask);
    setName('');
    loadTasks();
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteSchedulerTask(id);
    loadTasks();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-sky-400" />
          <span>Download Scheduler</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">Schedule automatic download start/stop windows (e.g. night downloads 01:00 AM to 06:00 AM).</p>
      </div>

      {/* Add Task Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">Add Scheduled Task</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Task Name (e.g., Night Downloads)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Start:</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Stop:</span>
            <input
              type="time"
              value={stopTime}
              onChange={(e) => setStopTime(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100"
            />
          </div>
          <button
            onClick={handleAddTask}
            disabled={!name}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Schedule</span>
          </button>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Schedules</h3>
        {tasks.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-xs text-slate-500">
            No scheduled tasks configured yet.
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-sky-400" />
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">{task.name}</h4>
                    <p className="text-xs text-slate-400">
                      Runs from {task.startTime} to {task.stopTime} ({task.action})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

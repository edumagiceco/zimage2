'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalUsers: number;
  totalImages: number;
  activeWorkers: number;
  pendingTasks: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalImages: 0,
    activeWorkers: 0,
    pendingTasks: 0,
  });

  useEffect(() => {
    // TODO: Fetch actual stats from API
    setStats({
      totalUsers: 42,
      totalImages: 1234,
      activeWorkers: 1,
      pendingTasks: 0,
    });
  }, []);

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, color: 'bg-blue-500' },
    { label: 'Generated Images', value: stats.totalImages, color: 'bg-green-500' },
    { label: 'Active Workers', value: stats.activeWorkers, color: 'bg-purple-500' },
    { label: 'Pending Tasks', value: stats.pendingTasks, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                  <div className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.label}
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {stat.value.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Links</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <a
            href="http://localhost:5555"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border rounded-lg hover:bg-gray-50 text-center"
          >
            <div className="text-sm font-medium text-gray-900">Flower</div>
            <div className="text-xs text-gray-500">Task Monitor</div>
          </a>
          <a
            href="http://localhost:3002"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border rounded-lg hover:bg-gray-50 text-center"
          >
            <div className="text-sm font-medium text-gray-900">Grafana</div>
            <div className="text-xs text-gray-500">Monitoring</div>
          </a>
          <a
            href="http://localhost:9021"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border rounded-lg hover:bg-gray-50 text-center"
          >
            <div className="text-sm font-medium text-gray-900">MinIO</div>
            <div className="text-xs text-gray-500">Object Storage</div>
          </a>
          <a
            href="http://localhost:8889"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 border rounded-lg hover:bg-gray-50 text-center"
          >
            <div className="text-sm font-medium text-gray-900">Traefik</div>
            <div className="text-xs text-gray-500">Proxy Dashboard</div>
          </a>
        </div>
      </div>
    </div>
  );
}

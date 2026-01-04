'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import {
  Settings,
  Server,
  Database,
  Cpu,
  HardDrive,
  Image as ImageIcon,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Zap,
  Globe,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import api from '@/lib/api';

// Available timezones
const TIMEZONES = [
  { value: 'Asia/Seoul', label: '한국 (GMT+9)', offset: '+09:00' },
  { value: 'Asia/Tokyo', label: '일본 (GMT+9)', offset: '+09:00' },
  { value: 'Asia/Shanghai', label: '중국 (GMT+8)', offset: '+08:00' },
  { value: 'America/New_York', label: '뉴욕 (GMT-5/-4)', offset: '-05:00' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스 (GMT-8/-7)', offset: '-08:00' },
  { value: 'Europe/London', label: '런던 (GMT+0/+1)', offset: '+00:00' },
  { value: 'Europe/Paris', label: '파리 (GMT+1/+2)', offset: '+01:00' },
  { value: 'UTC', label: 'UTC (GMT+0)', offset: '+00:00' },
];

interface SystemStats {
  timestamp: string;
  timezone: string;
  services: Record<string, { status: string; latency_ms?: number; error?: string }>;
  images: {
    total_count: number;
    today_count: number;
  };
  storage: {
    used: string;
    available: string;
    total: string;
    percent?: number;
  };
  model: {
    name: string;
    type: string;
    version: string;
    status: string;
  };
  resources: {
    cpu_percent: number;
    memory_percent: number;
    memory_used_gb: number;
    memory_total_gb: number;
    gpu: {
      name: string;
      memory_used_gb: number;
      memory_total_gb: number;
      memory_free_gb: number;
      memory_percent: number;
      utilization_percent: number;
      temperature_c: number;
      power_draw_w: number;
      power_limit_w: number;
    } | null;
  };
}

interface SystemConfig {
  timezone: string;
  model: {
    name: string;
    base: string;
    version: string;
    max_resolution: string;
    supported_formats: string[];
  };
  limits: {
    max_images_per_request: number;
    max_prompt_length: number;
    rate_limit: string;
  };
  storage: {
    type: string;
    bucket: string;
  };
  features: Record<string, boolean>;
}

async function getSystemStats(): Promise<SystemStats> {
  const response = await api.get('/api/system/stats');
  return response.data;
}

async function getSystemConfig(): Promise<SystemConfig> {
  const response = await api.get('/api/system/config');
  return response.data;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'healthy' || status === 'running' || status === 'ready') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        정상
      </span>
    );
  }
  if (status === 'unhealthy' || status === 'stopped') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <XCircle className="w-3.5 h-3.5" />
        중지됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
      <AlertCircle className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color = 'violet',
}: {
  icon: any;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'violet' | 'blue' | 'green' | 'orange' | 'pink';
}) {
  const colorClasses = {
    violet: 'from-violet-500 to-purple-500',
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    orange: 'from-orange-500 to-amber-500',
    pink: 'from-pink-500 to-rose-500',
  };

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} text-white`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [selectedTimezone, setSelectedTimezone] = useState('Asia/Seoul');
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Load saved timezone on mount
  useEffect(() => {
    const saved = localStorage.getItem('zimage-timezone');
    if (saved) {
      setSelectedTimezone(saved);
    }
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTimezoneChange = (tz: string) => {
    setSelectedTimezone(tz);
    localStorage.setItem('zimage-timezone', tz);
    setShowTimezoneDropdown(false);
  };

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['system-stats'],
    queryFn: getSystemStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: getSystemConfig,
  });

  const isLoading = statsLoading || configLoading;

  const formatTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      timeZone: selectedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getCurrentTimezoneLabel = () => {
    return TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-background dark:from-slate-950/50">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Settings className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">시스템 설정</h1>
            </div>
            <p className="text-muted-foreground">
              시스템 상태 및 설정을 확인합니다.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetchStats()}
            disabled={statsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {statsError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
            <p className="text-destructive">시스템 정보를 불러오는데 실패했습니다.</p>
          </div>
        )}

        {stats && config && (
          <div className="space-y-8">
            {/* Current Time & Timezone */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">시간 설정</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">현재 시간</p>
                  <p className="text-xl font-mono">{formatTime(currentTime)}</p>
                </div>
                <div className="relative">
                  <p className="text-sm text-muted-foreground mb-1">타임존</p>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-left font-medium"
                    onClick={() => setShowTimezoneDropdown(!showTimezoneDropdown)}
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {getCurrentTimezoneLabel()}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showTimezoneDropdown ? 'rotate-180' : ''}`} />
                  </Button>
                  {showTimezoneDropdown && (
                    <div className="absolute z-50 mt-1 w-full bg-card border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {TIMEZONES.map((tz) => (
                        <button
                          key={tz.value}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 flex items-center justify-between ${
                            selectedTimezone === tz.value ? 'bg-muted' : ''
                          }`}
                          onClick={() => handleTimezoneChange(tz.value)}
                        >
                          <span>{tz.label}</span>
                          {selectedTimezone === tz.value && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">서버 상태</p>
                  <StatusBadge status="healthy" />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={ImageIcon}
                title="전체 이미지"
                value={stats.images.total_count.toLocaleString()}
                subtitle="생성된 총 이미지 수"
                color="violet"
              />
              <StatCard
                icon={Zap}
                title="오늘 생성"
                value={stats.images.today_count.toLocaleString()}
                subtitle="오늘 생성된 이미지"
                color="blue"
              />
              <StatCard
                icon={HardDrive}
                title="스토리지 사용량"
                value={stats.storage.used}
                subtitle={`전체 ${stats.storage.total}`}
                color="green"
              />
              <StatCard
                icon={Cpu}
                title="CPU 사용률"
                value={`${stats.resources.cpu_percent}%`}
                subtitle="현재 CPU 사용량"
                color="orange"
              />
            </div>

            {/* Services Status */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">서비스 상태</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(stats.services).map(([name, info]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium capitalize">{name.replace('-', ' ')}</p>
                      {info.latency_ms !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          응답시간: {info.latency_ms}ms
                        </p>
                      )}
                    </div>
                    <StatusBadge status={info.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* AI Model Info */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">AI 모델 정보</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">모델명</span>
                    <span className="font-medium">{config.model.name}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">베이스 모델</span>
                    <span className="font-medium">{config.model.base}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">버전</span>
                    <span className="font-medium">{config.model.version}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">상태</span>
                    <StatusBadge status={stats.model.status} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">최대 해상도</span>
                    <span className="font-medium">{config.model.max_resolution}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">지원 포맷</span>
                    <span className="font-medium">{config.model.supported_formats.join(', ')}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-muted-foreground">요청당 최대 이미지</span>
                    <span className="font-medium">{config.limits.max_images_per_request}장</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Rate Limit</span>
                    <span className="font-medium">{config.limits.rate_limit}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Resources */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">시스템 리소스</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CPU */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">CPU 사용률</span>
                    <span className="text-sm text-muted-foreground">{stats.resources.cpu_percent}%</span>
                  </div>
                  <Progress value={stats.resources.cpu_percent} className="h-2" />
                </div>

                {/* Memory */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">메모리 사용률</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.resources.memory_used_gb} / {stats.resources.memory_total_gb} GB ({stats.resources.memory_percent}%)
                    </span>
                  </div>
                  <Progress value={stats.resources.memory_percent} className="h-2" />
                </div>

                {/* Storage */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">스토리지 사용률</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.storage.used} / {stats.storage.total}
                    </span>
                  </div>
                  <Progress value={stats.storage.percent || 0} className="h-2" />
                </div>

                {/* GPU VRAM */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">GPU VRAM</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.resources.gpu
                        ? `${stats.resources.gpu.memory_used_gb} / ${stats.resources.gpu.memory_total_gb} GB (${stats.resources.gpu.memory_percent}%)`
                        : 'N/A'}
                    </span>
                  </div>
                  <Progress value={stats.resources.gpu?.memory_percent || 0} className="h-2" />
                </div>

                {/* GPU Utilization */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">GPU 사용률</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.resources.gpu
                        ? `${stats.resources.gpu.utilization_percent}%`
                        : 'N/A'}
                    </span>
                  </div>
                  <Progress value={stats.resources.gpu?.utilization_percent || 0} className="h-2" />
                </div>
              </div>

              {/* GPU Details */}
              {stats.resources.gpu && stats.resources.gpu.memory_total_gb > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-medium mb-4">GPU 상세 정보</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">GPU 모델</p>
                      <p className="font-medium text-sm truncate">{stats.resources.gpu.name}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">VRAM 여유</p>
                      <p className="font-medium text-sm">{stats.resources.gpu.memory_free_gb} GB</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">온도</p>
                      <p className="font-medium text-sm">{stats.resources.gpu.temperature_c}°C</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">전력 사용량</p>
                      <p className="font-medium text-sm">
                        {stats.resources.gpu.power_draw_w}W / {stats.resources.gpu.power_limit_w}W
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Storage Info */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">스토리지 설정</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">스토리지 타입</p>
                  <p className="font-medium">{config.storage.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">버킷</p>
                  <p className="font-medium font-mono">{config.storage.bucket}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">사용 가능 용량</p>
                  <p className="font-medium">{stats.storage.available}</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-card border rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">활성화된 기능</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(config.features).map(([feature, enabled]) => (
                  <div
                    key={feature}
                    className={`flex items-center gap-2 p-3 rounded-lg ${
                      enabled ? 'bg-green-50 dark:bg-green-900/20' : 'bg-muted'
                    }`}
                  >
                    {enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium capitalize">
                      {feature.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

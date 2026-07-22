import React from 'react';
import type { ComponentType } from '../../types';

interface ServiceIconProps {
  type: ComponentType;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export const ServiceIcon: React.FC<ServiceIconProps> = ({ type, className = '', style = {}, size = 20 }) => {
  const mergedStyle = {
    width: size,
    height: size,
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0,
    ...style,
  };

  // Helper for path rendering to keep it clean
  switch (type) {
    // === CLIENTS ===
    case 'client': // Web browser / React style
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'mobile': // Phone / Mobile Client
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" />
        </svg>
      );

    // === TRAFFIC & EDGE ===
    case 'dns': // DNS / Domain Name System (Cloud)
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#3b82f6" opacity="0.8" />
          <path d="M2 17l10 5 10-5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12l10 5 10-5" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'cdn': // CDN Edge Network (Cloudflare orange wave/grid)
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="#f97316" strokeWidth="2" />
          <path d="M12 6v12M6 12h12M8 8l8 8M16 8l-8 8" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3" fill="#f97316" />
        </svg>
      );
    case 'load-balancer': // Nginx/HAProxy (balanced forks)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M12 3v18" />
          <path d="M5 10h14" />
          <path d="M5 10a3 3 0 0 1-3 3v4" />
          <path d="M19 10a3 3 0 0 0 3 3v4" />
          <circle cx="12" cy="3" r="1" fill="#0ea5e9" />
          <circle cx="2" cy="17" r="1" fill="#0ea5e9" />
          <circle cx="22" cy="17" r="1" fill="#0ea5e9" />
        </svg>
      );
    case 'waf': // Shield / FireWall (Cloudflare WAF)
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#ef4444" opacity="0.2" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 11h8M8 14h8M10 8h4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'api-gateway': // API Gateway (Routing branching)
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="16" y="2" width="6" height="6" rx="1" />
          <rect x="16" y="16" width="6" height="6" rx="1" />
          <rect x="2" y="9" width="6" height="6" rx="1" />
          <path d="M8 12h4v-5h4M12 12v7h4" />
        </svg>
      );
    case 'ingress': // Kubernetes Ingress style set of arrows
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M4 12h16M14 6l6 6-6 6" />
          <rect x="2" y="2" width="6" height="4" rx="1" fill="#8b5cf6" opacity="0.3" />
          <rect x="16" y="18" width="6" height="4" rx="1" fill="#8b5cf6" opacity="0.3" />
        </svg>
      );

    // === COMPUTE ===
    case 'app-server': // Server Rack / JVM / Node.js
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
          <line x1="20" y1="6" x2="16" y2="6" />
          <line x1="20" y1="18" x2="16" y2="18" />
        </svg>
      );
    case 'worker': // Gears / Worker Thread
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'serverless': // AWS Lambda style icon
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#f97316" opacity="0.3" />
          <path d="M6 14.5l6-3.5 6 3.5-6 3.5-6-3.5z" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 11v11" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'auth-service': // Auth / Keycloak style shield key
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'search': // Search / Elasticsearch style lens + grid
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'scheduler': // Cron / Scheduler Clock
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'notifications': // Notification bell
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'analytics': // Chart bars / Spark
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      );

    // === STORAGE ===
    case 'sql-database': // PostgreSQL elephant style cylinder
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 2C6.48 2 2 4.02 2 6.5v11c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z" fill="#3b82f6" opacity="0.1" />
          <path d="M22 6.5c0 2.48-4.48 4.5-10 4.5S2 8.98 2 6.5M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5M2 17.5c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5" stroke="#3b82f6" strokeWidth="2" />
          <path d="M12 2c5.52 0 10 2.02 10 4.5S17.52 11 12 11 2 8.98 2 6.5 6.48 2 12 2z" stroke="#60a5fa" strokeWidth="2" />
        </svg>
      );
    case 'nosql-db': // MongoDB Leaf style cylinder
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 2C6.48 2 2 4.02 2 6.5v11c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-11C22 4.02 17.52 2 12 2z" fill="#22c55e" opacity="0.1" />
          <path d="M22 6.5c0 2.48-4.48 4.5-10 4.5S2 8.98 2 6.5M2 12c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5M2 17.5c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5" stroke="#22c55e" strokeWidth="2" />
          <path d="M12 6.5a2 2 0 0 0 2-2V2s-4 1.5-4 4.5c0 1.1.9 2 2 2z" fill="#4ade80" />
        </svg>
      );
    case 'cache': // Redis thunder / grid logo
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#ef4444" opacity="0.8" />
          <path d="M2 17l10 5 10-5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 12l10 5 10-5" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 2v20" stroke="#fca5a5" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      );
    case 'object-store': // AWS S3 bucket logo
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#84cc16" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M12 22a9 9 0 0 0 9-9V9a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4a9 9 0 0 0 9 9z" />
          <path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v3" />
          <circle cx="12" cy="13" r="2" />
        </svg>
      );
    case 'data-warehouse': // Cube / Snowflake style
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'vector-db': // Vector pinecone / relational nodes
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <circle cx="12" cy="5" r="3" fill="#10b981" />
          <circle cx="5" cy="19" r="3" />
          <circle cx="19" cy="19" r="3" />
          <line x1="12" y1="8" x2="6.5" y2="16.5" />
          <line x1="12" y1="8" x2="17.5" y2="16.5" />
          <line x1="8" y1="19" x2="16" y2="19" />
        </svg>
      );

    // === MESSAGING ===
    case 'message-queue': // RabbitMQ style mailbox/queue nodes
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
          <line x1="15" y1="21" x2="15" y2="9" />
          <circle cx="6" cy="15" r="1.5" fill="#ec4899" />
          <circle cx="12" cy="15" r="1.5" fill="#ec4899" />
          <circle cx="18" cy="15" r="1.5" fill="#ec4899" />
        </svg>
      );
    case 'pub-sub': // Branching / distribution
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <circle cx="12" cy="12" r="3" fill="#f43f5e" />
          <path d="M19 5l-4.5 4.5M5 19l4.5-4.5M5 5l4.5 4.5M19 19l-4.5-4.5" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    case 'event-stream': // Flowing lines
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M2 8h20M2 12h20M2 16h20" strokeDasharray="4 4" />
          <circle cx="6" cy="8" r="1" fill="#f97316" />
          <circle cx="14" cy="12" r="1" fill="#f97316" />
          <circle cx="10" cy="16" r="1" fill="#f97316" />
        </svg>
      );
    case 'kafka': // Apache Kafka official logo stylized (three circles connected to a bar)
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <rect x="2" y="2" width="20" height="20" rx="4" fill="#1e293b" />
          <circle cx="7" cy="12" r="3" fill="#ffffff" />
          <circle cx="17" cy="7" r="3" fill="#ffffff" />
          <circle cx="17" cy="17" r="3" fill="#ffffff" />
          <path d="M7 12l10-5M7 12l10 5" stroke="#ffffff" strokeWidth="2.5" />
        </svg>
      );

    // === OBSERVABILITY ===
    case 'metrics': // Prometheus orange flame or grid
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M3 3v18h18" />
          <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
        </svg>
      );
    case 'logs': // Log document list
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'tracing': // Jaeger tracing spans
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M4 6h16M7 12h10M10 18h6" />
          <circle cx="4" cy="6" r="1" fill="#60a5fa" />
          <circle cx="7" cy="12" r="1" fill="#60a5fa" />
          <circle cx="10" cy="18" r="1" fill="#60a5fa" />
        </svg>
      );
    case 'alerting': // Bell ring
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'health-check': // Heartbeat rate
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );

    // === NETWORK ===
    case 'vpc': // Private cloud rectangle
      return (
        <svg viewBox="0 0 24 24" fill="none" className={className} style={mergedStyle}>
          <rect x="2" y="3" width="20" height="18" rx="2" stroke="#6366f1" strokeWidth="2" fill="#6366f1" fillOpacity="0.05" />
          <path d="M7 8h10M7 12h10M7 16h6" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'subnet': // Small grid block
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={mergedStyle}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} style={mergedStyle}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

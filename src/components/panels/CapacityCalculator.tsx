import React, { useState, useEffect } from 'react';
import { X, Users, HardDrive, Globe, Zap, Calculator } from 'lucide-react';

type Tab = 'traffic' | 'storage' | 'bandwidth' | 'cache';

// Helper to format bytes nicely
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper to format bits per second
const formatBps = (bytesPerSec: number): string => {
  const bitsPerSec = bytesPerSec * 8;
  if (bitsPerSec === 0) return '0 bps';
  const k = 1000; // network bits use decimal k
  const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps'];
  const i = Math.floor(Math.log(bitsPerSec) / Math.log(k));
  return parseFloat((bitsPerSec / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface SyncInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}

const SyncInput: React.FC<SyncInputProps> = ({ label, value, min, max, step, unit, onChange }) => {
  const [temp, setTemp] = useState(String(value));

  useEffect(() => {
    setTemp(String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTemp(e.target.value);
    const val = Number(e.target.value);
    if (!isNaN(val) && e.target.value !== '' && val >= min && val <= max) {
      onChange(val);
    }
  };

  const handleBlurOrEnter = () => {
    let val = Number(temp);
    if (isNaN(val) || temp === '') {
      val = value;
    }
    const clamped = Math.max(min, Math.min(max, val));
    onChange(clamped);
    setTemp(String(clamped));
  };

  return (
    <div className="config-field" style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span className="config-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={temp}
            onChange={handleChange}
            onBlur={handleBlurOrEnter}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleBlurOrEnter();
                e.currentTarget.blur();
              }
            }}
            style={{
              width: '80px',
              padding: '3px 6px',
              background: '#192231',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
            }}
          />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="config-slider"
      />
    </div>
  );
};

export const CapacityCalculator: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('traffic');

  // Traffic state
  const [dau, setDau] = useState(10000000); // 10M
  const [reqsPerUser, setReqsPerUser] = useState(10);
  const [peakFactor, setPeakFactor] = useState(2);

  // Storage state
  const [writeRps, setWriteRps] = useState(100);
  const [rowSize, setRowSize] = useState(1);
  const [rowUnit, setRowUnit] = useState<'B' | 'KB' | 'MB' | 'GB'>('KB');
  const [retentionDays, setRetentionDays] = useState(30);

  // Bandwidth state
  const [totalQps, setTotalQps] = useState(1000);
  const [reqSize, setReqSize] = useState(50);
  const [reqUnit, setReqUnit] = useState<'B' | 'KB' | 'MB'>('KB');

  // Cache state
  const [readRps, setReadRps] = useState(1000);
  const [itemSize, setItemSize] = useState(20);
  const [itemUnit, setItemUnit] = useState<'B' | 'KB' | 'MB'>('KB');
  const [paretoRatio, setParetoRatio] = useState(20); // 20% cached

  // Calculations
  // 1. Traffic
  const avgQps = (dau * reqsPerUser) / 86400;
  const peakQps = avgQps * peakFactor;

  // 2. Storage
  const unitMultipliers = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
  const rowSizeBytes = rowSize * unitMultipliers[rowUnit];
  const storagePerDay = writeRps * rowSizeBytes * 86400;
  const totalStorageBytes = storagePerDay * retentionDays;

  // 3. Bandwidth
  const bwMultipliers = { B: 1, KB: 1024, MB: 1024 * 1024 };
  const reqSizeBytes = reqSize * bwMultipliers[reqUnit];
  const totalBwBytesPerSec = totalQps * reqSizeBytes;

  // 4. Cache
  const cacheItemSizeBytes = itemSize * bwMultipliers[itemUnit];
  const totalReadBytesPerDay = readRps * cacheItemSizeBytes * 86400;
  const cacheBytesRequired = totalReadBytesPerDay * (paretoRatio / 100);

  return (
    <aside className="calculator-panel">
      <div className="calculator-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={18} className="brand-icon" style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Conta de Padaria</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="calculator-tabs">
        <button className={`calc-tab ${activeTab === 'traffic' ? 'active' : ''}`} onClick={() => setActiveTab('traffic')}>
          <Users size={12} />
          Tráfego
        </button>
        <button className={`calc-tab ${activeTab === 'storage' ? 'active' : ''}`} onClick={() => setActiveTab('storage')}>
          <HardDrive size={12} />
          Storage
        </button>
        <button className={`calc-tab ${activeTab === 'bandwidth' ? 'active' : ''}`} onClick={() => setActiveTab('bandwidth')}>
          <Globe size={12} />
          Banda
        </button>
        <button className={`calc-tab ${activeTab === 'cache' ? 'active' : ''}`} onClick={() => setActiveTab('cache')}>
          <Zap size={12} />
          Cache
        </button>
      </div>

      <div className="calculator-body">
        {activeTab === 'traffic' && (
          <div>
            <SyncInput label="Daily Active Users (DAU)" value={dau} min={1000} max={100000000} step={100000} unit=" usuários" onChange={setDau} />
            <SyncInput label="Requisições por Usuário / Dia" value={reqsPerUser} min={1} max={500} step={1} unit=" reqs" onChange={setReqsPerUser} />
            <SyncInput label="Fator de Tráfego de Pico" value={peakFactor} min={1} max={10} step={0.5} unit="×" onChange={setPeakFactor} />

            <div className="formula-box">
              <div className="formula-title">Fórmula QPS Médio:</div>
              <code className="formula-text">QPS = (DAU × Reqs) / 86.400</code>
              <div className="formula-calc">
                ({dau.toLocaleString()} × {reqsPerUser}) / 86.400 = <strong>{Math.round(avgQps).toLocaleString()} RPS</strong>
              </div>

              <div className="formula-title" style={{ marginTop: '12px' }}>Fórmula QPS de Pico:</div>
              <code className="formula-text">Peak = QPS × Fator</code>
              <div className="formula-calc">
                {Math.round(avgQps).toLocaleString()} × {peakFactor} = <strong style={{ color: 'var(--accent)' }}>{Math.round(peakQps).toLocaleString()} RPS</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div>
            <SyncInput label="RPS de Escrita" value={writeRps} min={1} max={50000} step={10} unit=" rps" onChange={setWriteRps} />

            {/* Row size input with unit selector */}
            <div className="config-field" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="config-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tamanho do Registro</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={rowSize}
                    onChange={(e) => setRowSize(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: '60px',
                      padding: '3px 6px',
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      textAlign: 'right',
                    }}
                  />
                  <select
                    value={rowUnit}
                    onChange={(e) => setRowUnit(e.target.value as any)}
                    style={{
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      padding: '2px',
                    }}
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                    <option value="GB">GB</option>
                  </select>
                </div>
              </div>
            </div>

            <SyncInput label="Tempo de Retenção" value={retentionDays} min={1} max={3650} step={1} unit=" dias" onChange={setRetentionDays} />

            <div className="formula-box">
              <div className="formula-title">Fórmula de Storage Diário:</div>
              <code className="formula-text">Dia = RPS × Tamanho × 86.400</code>
              <div className="formula-calc">
                {writeRps} × {rowSize} {rowUnit} × 86.400 = <strong>{formatBytes(storagePerDay)} / dia</strong>
              </div>

              <div className="formula-title" style={{ marginTop: '12px' }}>Fórmula de Armazenamento Total:</div>
              <code className="formula-text">Total = Dia × Dias Retenção</code>
              <div className="formula-calc">
                {formatBytes(storagePerDay)} × {retentionDays} = <strong style={{ color: 'var(--accent)' }}>{formatBytes(totalStorageBytes)}</strong>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bandwidth' && (
          <div>
            <SyncInput label="QPS Total" value={totalQps} min={1} max={500000} step={100} unit=" rps" onChange={setTotalQps} />

            <div className="config-field" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="config-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tamanho Médio Request</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={reqSize}
                    onChange={(e) => setReqSize(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: '60px',
                      padding: '3px 6px',
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      textAlign: 'right',
                    }}
                  />
                  <select
                    value={reqUnit}
                    onChange={(e) => setReqUnit(e.target.value as any)}
                    style={{
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      padding: '2px',
                    }}
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="formula-box">
              <div className="formula-title">Fórmula de Largura de Banda:</div>
              <code className="formula-text">Bandwidth = QPS × Request Size</code>
              <div className="formula-calc">
                {totalQps.toLocaleString()} × {reqSize} {reqUnit} =
                <div style={{ marginTop: '6px' }}>
                  Banda em Bytes: <strong style={{ color: 'var(--text-primary)' }}>{formatBytes(totalBwBytesPerSec)}/s</strong>
                </div>
                <div style={{ marginTop: '2px' }}>
                  Banda de Rede: <strong style={{ color: 'var(--accent)' }}>{formatBps(totalBwBytesPerSec)}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cache' && (
          <div>
            <SyncInput label="QPS de Leitura" value={readRps} min={1} max={500000} step={100} unit=" rps" onChange={setReadRps} />

            <div className="config-field" style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span className="config-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tamanho Médio Item</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={itemSize}
                    onChange={(e) => setItemSize(Math.max(1, Number(e.target.value)))}
                    style={{
                      width: '60px',
                      padding: '3px 6px',
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      textAlign: 'right',
                    }}
                  />
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value as any)}
                    style={{
                      background: '#192231',
                      border: '1px solid #334155',
                      borderRadius: '4px',
                      color: '#ffffff',
                      fontSize: '11px',
                      padding: '2px',
                    }}
                  >
                    <option value="B">B</option>
                    <option value="KB">KB</option>
                    <option value="MB">MB</option>
                  </select>
                </div>
              </div>
            </div>

            <SyncInput label="Regra de Pareto (Dados em Cache)" value={paretoRatio} min={5} max={100} step={5} unit="%" onChange={setParetoRatio} />

            <div className="formula-box">
              <div className="formula-title">Volume de Leitura Diária:</div>
              <code className="formula-text">Leituras/Dia = QPS × Tamanho × 86.400</code>
              <div className="formula-calc">
                {readRps.toLocaleString()} × {itemSize} {itemUnit} × 86.400 = <strong>{formatBytes(totalReadBytesPerDay)}/dia</strong>
              </div>

              <div className="formula-title" style={{ marginTop: '12px' }}>Fórmula de Memória Recomendada:</div>
              <code className="formula-text">Cache RAM = Vol Diário × Pareto</code>
              <div className="formula-calc">
                {formatBytes(totalReadBytesPerDay)} × {paretoRatio}% = <strong style={{ color: 'var(--accent)' }}>{formatBytes(cacheBytesRequired)}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

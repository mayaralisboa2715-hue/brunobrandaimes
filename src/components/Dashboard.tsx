import React, { useState } from 'react';
import { 
  Package, 
  ArrowRightLeft, 
  CheckCircle2, 
  Users,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { DashboardStats } from '../types';
import { cn } from '../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: any;
  color: string;
  description: string;
}

function StatCard({ title, value, icon: Icon, color, description }: StatCardProps) {
  return (
    <div 
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
    >
      <div className="text-slate-500 text-[10px] font-black uppercase mb-1 tracking-widest">{title}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-mono font-black text-slate-800 flex items-baseline gap-1">
          {value}
          <span className="text-[10px] font-normal text-slate-400 font-sans">{title === 'Estoque Geral' || title === 'Disponível' ? 'pçs' : ''}</span>
        </div>
        <div className={cn("p-1.5 rounded-md text-white shadow-sm", color)}>
          <Icon size={16} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ stats }: { stats: DashboardStats }) {
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const testConnection = async () => {
    setTestStatus('Testando...');
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setTestStatus(`Sucesso! Status: ${data.status}`);
    } catch (e) {
      setTestStatus(`Falha: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  const fetchServerLogs = async () => {
    try {
      const res = await fetch('/api/debug/logs');
      const data = await res.json();
      setServerLogs(data);
      setShowLogs(true);
    } catch (e) {
      alert('Falha ao buscar logs do servidor');
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Connection (DEBUG) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Verificação de Sistema</h3>
            <p className="text-xs text-slate-500">{testStatus || 'Pronto para teste'} | {window.location.host}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={testConnection}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors border border-slate-200"
            >
              Testar Conexão
            </button>
            <button 
              onClick={fetchServerLogs}
              className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              Logs do Servidor
            </button>
          </div>
        </div>

        {showLogs && (
          <div className="mt-4 p-3 bg-slate-900 rounded-lg overflow-auto max-h-80">
            <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Logs Recentes</span>
              <button onClick={() => setShowLogs(false)} className="text-slate-400 hover:text-white uppercase text-[10px] font-bold">Fechar</button>
            </div>
            {serverLogs.length === 0 && <div className="text-[10px] text-slate-500 italic">Sem logs registrados</div>}
            {[...serverLogs].reverse().map((log, i) => (
              <div key={i} className={cn(
                "text-[10px] font-mono whitespace-nowrap mb-0.5",
                log.includes('ERROR') ? 'text-red-400' : 
                log.includes('WARN') ? 'text-amber-400' :
                log.includes('RECV') ? 'text-sky-400' : 'text-emerald-400'
              )}>
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Estoque Geral" 
          value={stats.totalInventory} 
          icon={Package} 
          color="bg-slate-700"
          description="Total de peças cadastradas"
        />
        <StatCard 
          title="Disponível" 
          value={stats.availableInventory} 
          icon={CheckCircle2} 
          color="bg-emerald-500"
          description="Peças prontas para locação"
        />
        <StatCard 
          title="Locação Ativa" 
          value={stats.activeRentals} 
          icon={ArrowRightLeft} 
          color="bg-blue-500"
          description="Contratos em andamento"
        />
        <StatCard 
          title="Atrasos" 
          value={(stats as any).lateRentals || 0} 
          icon={AlertTriangle} 
          color="bg-red-500"
          description="Contratos com prazo vencido"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Alerts */}
        <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle size={14} className={cn((stats as any).lateRentals > 0 ? "text-red-500" : "text-amber-500")} />
            Alertas de Retorno
          </h2>
          <div className="space-y-3">
            {(stats as any).lateRentals > 0 ? (
              <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-red-700 text-sm">{(stats as any).lateRentals} Locações em Atraso</p>
                  <p className="text-xs text-red-600 font-medium">Notifique os clientes via WhatsApp imediatamente.</p>
                </div>
                <AlertTriangle size={20} className="text-red-500" />
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-700 text-sm">Nenhum atraso detectado</p>
                  <p className="text-xs text-slate-500 font-medium">As devoluções estão rigorosamente em dia.</p>
                </div>
                <CheckCircle2 size={20} className="text-emerald-500" />
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0F172A] p-6 rounded-xl text-white relative overflow-hidden shadow-xl border border-slate-700/50">
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-1 uppercase tracking-tighter italic">BR ANDAIMES PRO</h2>
            <p className="text-slate-400 text-[11px] mb-4 leading-relaxed font-semibold">
              CONTROLE DE ESTOQUE INDUSTRIAL E GESTÃO DE LOCAÇÕES EM TEMPO REAL.
            </p>
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
               <h3 className="text-orange-400 font-black text-[9px] uppercase mb-1 tracking-widest">Informações do Sistema</h3>
               <ul className="text-[10px] space-y-1.5 text-slate-300 font-mono font-medium">
                 <li>• Sincronização via Socket.io ativa</li>
                 <li>• Base de dados SQLite resiliente</li>
               </ul>
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-5">
            <Package size={160} />
          </div>
        </div>
      </div>
    </div>
  );
}

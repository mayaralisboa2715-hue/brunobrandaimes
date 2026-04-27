import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Plus, 
  Search, 
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  AlertCircle,
  Printer,
  Trash2,
  X,
  Menu,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from './lib/utils';
import { DashboardStats, InventoryItem, Customer, Rental } from './types';
import jsPDF from 'jspdf';

// Components
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Customers from './components/Customers';
import Rentals from './components/Rentals';

const socket = io();

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'customers' | 'rentals'>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalInventory: 0,
    availableInventory: 0,
    activeRentals: 0,
    totalCustomers: 0
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    socket.on('inventory_updated', fetchStats);
    socket.on('rentals_updated', fetchStats);
    socket.on('customers_updated', fetchStats);

    return () => {
      socket.off('inventory_updated');
      socket.off('rentals_updated');
      socket.off('customers_updated');
    };
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'inventory', label: 'Estoque', icon: Package },
    { id: 'customers', label: 'Clientes', icon: Users },
    { id: 'rentals', label: 'Locações', icon: ArrowRightLeft },
  ];

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#1E293B] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-[#0F172A] text-white transition-all duration-300 flex flex-col shadow-2xl",
          isSidebarOpen ? "w-60" : "w-16"
        )}
      >
        <div className="p-4 flex flex-col gap-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <img 
              src="https://i.ibb.co/B2jzCtLS/IMG-20260424-WA0031.jpg" 
              alt="Logo" 
              className="w-10 h-10 rounded border border-slate-600 object-cover shadow-sm" 
            />
            {isSidebarOpen && <span className="font-black text-xl tracking-tighter">BR ANDAIMES</span>}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all group",
                activeTab === item.id 
                  ? "bg-[#334155] text-white shadow-sm" 
                  : "text-slate-400 hover:bg-[#1E293B] hover:text-white"
              )}
            >
              <item.icon size={18} className={cn("shrink-0", activeTab === item.id ? "text-white" : "group-hover:text-white")} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700 bg-[#0A101F]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            {isSidebarOpen && <span className="text-[10px] uppercase font-bold text-slate-400 font-mono text-center">2 Usuários Online</span>}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 p-2 text-slate-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ChevronRight size={16} className={cn("transition-transform", isSidebarOpen && "rotate-180")} />
            {isSidebarOpen && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
             <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 px-3 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tempo Real</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#334155] text-white flex items-center justify-center text-xs font-black">
              BR
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard stats={stats} />}
            {activeTab === 'inventory' && <Inventory />}
            {activeTab === 'customers' && <Customers />}
            {activeTab === 'rentals' && <Rentals />}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

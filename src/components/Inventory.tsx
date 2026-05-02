import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit2, Search } from 'lucide-react';
import { InventoryItem } from '../types';
import { io } from 'socket.io-client';
import { cn } from '../lib/utils';

const socket = io();

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: 0, price: 0 });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchItems = async () => {
    const res = await fetch('/api/inventory');
    const data = await res.json();
    setItems(data);
  };

  useEffect(() => {
    fetchItems();
    socket.on('inventory_updated', fetchItems);
    return () => { socket.off('inventory_updated'); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/inventory/${editingItem.id}` : '/api/inventory';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erro no servidor' }));
        throw new Error(errorData.error || 'Erro ao salvar item no inventário');
      }
      
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: '', quantity: 0, price: 0 });
      await fetchItems();
      alert('Item salvo com sucesso!');
    } catch (error) {
      console.error('Error saving inventory item:', error);
      alert(error instanceof Error ? error.message : 'Erro ao conectar-se ao servidor');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta peça?')) return;
    try {
      const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao excluir item');
      }
      fetchItems();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      alert(error instanceof Error ? error.message : 'Erro ao excluir o item');
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Filtrar inventário..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#334155] outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setEditingItem(null);
            setFormData({ name: '', quantity: 0, price: 0 });
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto px-5 py-2 bg-[#F97316] text-white font-bold rounded-md text-sm shadow-sm hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          Adicionar Item
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição da Peça</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Preço Diária</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Estoque Total</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Locado</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Disponível</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredItems.map((item: any) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3 font-bold text-slate-700 text-sm">{item.name}</td>
                <td className="px-4 py-3 font-mono font-bold text-xs text-slate-500">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price || 0)}
                </td>
                <td className="px-4 py-3 font-mono font-bold text-xs text-slate-600">{item.quantity} pçs</td>
                <td className="px-4 py-3 font-mono font-bold text-xs text-blue-600 text-center">{item.rented || 0}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    "px-2 py-0.5 rounded font-mono font-black text-xs",
                    item.available > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    {item.available}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingItem(item);
                        setFormData({ name: item.name, quantity: item.quantity, price: item.price || 0 });
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#F97316]" />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6">{editingItem ? 'Editar Item' : 'Novo Item Estoque'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Descrição</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Qtd Total em Inventário</label>
                <input 
                  type="number" 
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                  value={formData.quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setFormData({ ...formData, quantity: isNaN(val) ? 0 : val });
                  }}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Preço Unitário (Diária/Semana)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                  value={formData.price}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setFormData({ ...formData, price: isNaN(val) ? 0 : val });
                  }}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs text-slate-500 font-bold uppercase tracking-widest hover:bg-slate-50 rounded-lg transition-colors border border-transparent"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all shadow-md active:scale-95"
                >
                  Salvar Peça
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

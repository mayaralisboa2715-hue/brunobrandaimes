import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Edit2, Search, Phone, MapPin, CreditCard } from 'lucide-react';
import { Customer } from '../types';
import { io } from 'socket.io-client';

const socket = io();

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', tax_id: '', address: '', phone: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
  };

  useEffect(() => {
    fetchCustomers();
    socket.on('customers_updated', fetchCustomers);
    return () => { socket.off('customers_updated'); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingCustomer ? 'PUT' : 'POST';
    const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erro no servidor' }));
        throw new Error(errorData.error || 'Erro ao salvar cliente');
      }
      
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', tax_id: '', address: '', phone: '' });
      await fetchCustomers();
      alert('Cliente salvo com sucesso!');
    } catch (error) {
      console.error('Error saving customer:', error);
      alert(error instanceof Error ? error.message : 'Erro ao conectar-se ao servidor');
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tax_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Filtrar clientes..." 
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#334155] outline-none shadow-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => {
            setEditingCustomer(null);
            setFormData({ name: '', tax_id: '', address: '', phone: '' });
            setIsModalOpen(true);
          }}
          className="w-full md:w-auto px-5 py-2 bg-[#F97316] text-white font-bold rounded-md text-sm shadow-sm hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Cliente</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">CPF / CNPJ</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Contato</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Endereço</th>
              <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center text-[10px] font-black text-slate-600">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-700 text-sm">{customer.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{customer.tax_id}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Phone size={12} className="text-slate-400" />
                    <span className="text-xs font-semibold">{customer.phone}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600 max-w-[200px]">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span className="text-xs truncate">{customer.address}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button 
                    onClick={() => {
                      setEditingCustomer(customer);
                      setFormData({ 
                        name: customer.name, 
                        tax_id: customer.tax_id, 
                        address: customer.address, 
                        phone: customer.phone 
                      });
                      setIsModalOpen(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#F97316]" />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-6">{editingCustomer ? 'Editar Cliente' : 'Novo Cadastro Cliente'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Nome Completo / Razão Social</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">CPF / CNPJ</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">WhatsApp</label>
                  <input 
                    type="text" 
                    required
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Endereço de Entrega</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs text-slate-500 font-bold uppercase tracking-widest hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-700 transition-all shadow-md"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

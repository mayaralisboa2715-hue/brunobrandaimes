import React, { useState, useEffect } from 'react';
import { 
  ArrowRightLeft, 
  Plus, 
  Search, 
  Printer, 
  MessageSquare, 
  CheckCircle2, 
  Calendar,
  User,
  Package,
  X,
  PlusCircle,
  MinusCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { Rental, Customer, InventoryItem, RentalItem } from '../types';
import { io } from 'socket.io-client';
import { cn, formatDate } from '../lib/utils';
import { format, isBefore, addDays, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const socket = io();

export default function Rentals() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  // New Rental Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [deliveryDate, setDeliveryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [returnDate, setReturnDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [selectedItems, setSelectedItems] = useState<{ inventory_id: number; quantity: number }[]>([]);

  const [searchTerm, setSearchTerm] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rRes, cRes, iRes] = await Promise.all([
        fetch('/api/rentals'),
        fetch('/api/customers'),
        fetch('/api/inventory')
      ]);
      setRentals(await rRes.json());
      setCustomers(await cRes.json());
      setInventory(await iRes.json());
    } finally {
      setLoading(false);
    }
  };

  const filteredRentals = rentals.filter(r => 
    r.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    fetchAll();
    socket.on('rentals_updated', fetchAll);
    socket.on('inventory_updated', fetchAll);
    socket.on('customers_updated', fetchAll);
    return () => {
      socket.off('rentals_updated');
      socket.off('inventory_updated');
      socket.off('customers_updated');
    };
  }, []);

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Por favor, selecione um cliente.');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Por favor, adicione pelo menos uma peça.');
      return;
    }

    setLoading(true);
    try {
      console.log('Sending rental request:', {
        customer_id: selectedCustomerId,
        delivery_date: deliveryDate,
        return_date: returnDate,
        items: selectedItems
      });
      
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          delivery_date: deliveryDate,
          return_date: returnDate,
          items: selectedItems
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Erro desconhecido no servidor' }));
        throw new Error(errorData.error || 'Erro ao gerar locação');
      }

      const responseData = await res.json();
      console.log('Rental created successfully:', responseData);

      setIsModalOpen(false);
      resetForm();
      await fetchAll();
      alert('Locação gerada com sucesso!');
    } catch (error) {
      console.error('Error creating rental:', error);
      alert(error instanceof Error ? error.message : 'Erro ao processar locação. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (id: number) => {
    if (!confirm('Confirmar devolução total das peças?')) return;
    try {
      const res = await fetch(`/api/rentals/${id}/return`, { method: 'POST' });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao processar devolução');
      }
      fetchAll();
    } catch (error) {
      console.error('Error processing return:', error);
      alert(error instanceof Error ? error.message : 'Erro ao registrar devolução');
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setDeliveryDate(format(new Date(), 'yyyy-MM-dd'));
    setReturnDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    setSelectedItems([]);
  };

  const addItem = (inventoryId: number) => {
    const item = inventory.find(i => i.id === inventoryId);
    if (!item) return;

    const existing = selectedItems.find(si => si.inventory_id === inventoryId);
    if (existing) {
      setSelectedItems(selectedItems.map(si => 
        si.inventory_id === inventoryId ? { ...si, quantity: si.quantity + 1 } : si
      ));
    } else {
      setSelectedItems([...selectedItems, { inventory_id: inventoryId, quantity: 1 }]);
    }
  };

  const removeItem = (inventoryId: number) => {
    const existing = selectedItems.find(si => si.inventory_id === inventoryId);
    if (existing && existing.quantity > 1) {
      setSelectedItems(selectedItems.map(si => 
        si.inventory_id === inventoryId ? { ...si, quantity: si.quantity - 1 } : si
      ));
    } else {
      setSelectedItems(selectedItems.filter(si => si.inventory_id !== inventoryId));
    }
  };

  const generatePDF = (rental: Rental) => {
    try {
      console.log('Generating PDF for rental:', rental);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // --- Header with Logo Style ---
      // Background bar
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // Accent bar (Orange)
      doc.setFillColor(249, 115, 22); // Orange #F97316
      doc.rect(0, 40, pageWidth, 5, 'F');
      
      // "Logo" Graphic - Simplified Scaffolding/Box icon
      doc.setDrawColor(249, 115, 22);
      doc.setLineWidth(1.5);
      doc.line(15, 10, 35, 10); // Top
      doc.line(15, 10, 15, 30); // Left
      doc.line(35, 10, 35, 30); // Right
      doc.line(15, 30, 35, 30); // Bottom
      doc.line(15, 10, 35, 30); // Diagonal
      doc.line(35, 10, 15, 30); // Diagonal
      
      // Company Name
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(26);
      doc.text('BR ANDAIMES', 42, 22);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(203, 213, 225); // Slate-300
      doc.text('LOCAÇÃO E MANUTENÇÃO DE EQUIPAMENTOS', 42, 29);
      
      // OS Label & ID
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`OS #${rental.id.toString().padStart(4, '0')}`, pageWidth - 15, 20, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`EMITIDA EM: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 15, 27, { align: 'right' });
      
      let y = 60;
      
      // --- Customer Section ---
      doc.setFillColor(241, 245, 249); // Slate-100
      doc.rect(15, y, pageWidth - 30, 8, 'F');
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('DADOS DO CLIENTE', 20, y + 5.5);
      y += 15;
      
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105); // Slate-600
      
      // Column 1
      doc.setFont('helvetica', 'bold');
      doc.text('NOME / RAZÃO SOCIAL:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(rental.customer_name || '-', 15, y + 5);
      
      doc.setFont('helvetica', 'bold');
      doc.text('CPF / CNPJ:', 15, y + 15);
      doc.setFont('helvetica', 'normal');
      doc.text(rental.customer_tax_id || '-', 15, y + 20);
      
      // Column 2
      doc.setFont('helvetica', 'bold');
      doc.text('CONTATO / WHATSAPP:', 110, y);
      doc.setFont('helvetica', 'normal');
      doc.text(rental.customer_phone || '-', 110, y + 5);
      
      doc.setFont('helvetica', 'bold');
      doc.text('ENDEREÇO:', 110, y + 15);
      doc.setFont('helvetica', 'normal');
      const addressLines = doc.splitTextToSize(rental.customer_address || '-', pageWidth / 2 - 20);
      doc.text(addressLines, 110, y + 20);
      
      y += 35;
      
      // --- Rental Period ---
      doc.setFillColor(241, 245, 249); // Slate-100
      doc.rect(15, y, pageWidth - 30, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('PERÍODO DE LOCAÇÃO', 20, y + 5.5);
      y += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('RETIRADA:', 15, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(22, 163, 74); // Green
      doc.text(formatDate(rental.delivery_date), 40, y);
      
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('PREVISÃO RETORNO:', 110, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(220, 38, 38); // Red
      doc.text(formatDate(rental.return_date), 155, y);
      
      y += 10;
      
      // --- Items Table ---
      const tableData = rental.items?.map((item, index) => {
        return [
          (index + 1).toString().padStart(2, '0'),
          item.item_name || '',
          item.quantity.toString(),
          'PEÇA'
        ];
      }) || [];
      
      autoTable(doc, {
        startY: y,
        head: [['ITEM', 'DESCRIÇÃO DA PEÇA', 'QUANTIDADE', 'UNID.']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [51, 65, 85], // Slate-700
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          2: { halign: 'center', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 }
        },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 15, right: 15 }
      });
      
      let finalY = (doc as any).lastAutoTable.finalY + 15;
      
      // --- Terms ---
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59); // Slate-800
      doc.setFont('helvetica', 'bold');
      
      const newTerms = [
        "*ENTREGAR AS PEÇAS LIMPAS OU TERÁ O ACRÉSCIMO DE R$5,00 POR PEÇA DE TAXA DE LIMPEZA.",
        "*PAGAMENTO NO ATO QUE O CLIENTE RECEBE AS PEÇAS.",
        "",
        "PIX: 56.058.801/0001-62",
        "(FAVOR ENVIAR O COMPROVANTE)"
      ];

      newTerms.forEach((line) => {
        doc.text(line, 20, finalY);
        finalY += 5;
      });
      
      finalY += 25;
      
      // --- Signatures ---
      doc.setDrawColor(203, 213, 225); // Slate-300
      doc.line(20, finalY, 90, finalY);
      doc.line(120, finalY, 190, finalY);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('CLIENTE / RESPONSÁVEL', 55, finalY + 5, { align: 'center' });
      doc.text('BR ANDAIMES - ASSINATURA', 155, finalY + 5, { align: 'center' });
      
      // Save
      doc.save(`OS_${rental.id.toString().padStart(3, '0')}_${rental.customer_name?.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF. Verifique os dados da locação.');
    }
  };

  const sendWhatsApp = (rental: Rental, type: 'reminder' | 'late') => {
    const phone = rental.customer_phone?.replace(/\D/g, '');
    if (!phone) return;

    let message = '';
    if (type === 'reminder') {
      message = `Olá ${rental.customer_name}, o BR ANDAIMES informa: sua locação de andaimes vence amanhã (${formatDate(rental.return_date)}). Favor providenciar a organização das peças para coleta/devolução. Obrigado!`;
    } else {
      message = `Olá ${rental.customer_name}, detectamos um atraso na devolução da sua locação de andaimes (Vencimento: ${formatDate(rental.return_date)}). Favor entrar em contato urgente para regularização!`;
    }

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Filtrar por cliente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#334155] outline-none shadow-sm transition-all"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto px-5 py-2 bg-[#F97316] text-white font-bold rounded-md text-sm shadow-sm hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={3} />
          Nova Locação
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredRentals.map((rental) => {
          const isLate = rental.status === 'ACTIVE' && isBefore(parseISO(rental.return_date), new Date());
          return (
            <div key={rental.id} className={cn(
              "bg-white rounded-xl border shadow-sm transition-all flex flex-col md:flex-row overflow-hidden",
              isLate ? "border-red-200 bg-red-50/10" : "border-slate-200 hover:border-slate-300"
            )}>
              <div className="flex-1 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-slate-600 font-black text-xs">
                      {rental.customer_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm leading-tight uppercase tabular-nums">
                        #{rental.id} - {rental.customer_name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 underline-offset-2">
                         <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            <Calendar size={10} /> {formatDate(rental.delivery_date)}
                         </div>
                         <div className="text-slate-300 text-[10px]">→</div>
                         <div className={cn(
                           "flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter",
                           isLate ? "text-red-500" : "text-slate-800"
                         )}>
                            <Calendar size={10} /> {formatDate(rental.return_date)}
                         </div>
                      </div>
                    </div>
                  </div>
                  <div className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border",
                    rental.status === 'ACTIVE' 
                      ? (isLate ? "bg-red-50 text-red-600 border-red-100" : "bg-amber-50 text-amber-600 border-amber-100") 
                      : "bg-emerald-50 text-emerald-600 border-emerald-100"
                  )}>
                    {rental.status === 'ACTIVE' ? (isLate ? 'ATRASADO' : 'ATIVO') : 'FINALIZADO'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {rental.items?.map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600 flex items-center gap-1.5">
                      <span className="text-slate-400 font-mono">[{item.quantity}]</span>
                      <span className="uppercase">{item.item_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100 p-3 flex md:flex-col justify-center gap-2 shrink-0">
                {rental.status === 'ACTIVE' && (
                  <>
                    <button 
                      onClick={() => handleReturn(rental.id)}
                      className="flex-1 md:flex-none p-2 bg-white border border-slate-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-tighter shadow-sm"
                    >
                      <CheckCircle2 size={14} strokeWidth={3} />
                      Entrega
                    </button>
                    <button 
                      onClick={() => sendWhatsApp(rental, isLate ? 'late' : 'reminder')}
                      className="flex-1 md:flex-none p-2 bg-white border border-slate-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-tighter shadow-sm"
                    >
                      <MessageSquare size={14} strokeWidth={3} />
                      Wpp
                    </button>
                  </>
                )}
                <button 
                  onClick={() => generatePDF(rental)}
                  className="flex-1 md:flex-none p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-100 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-tighter shadow-sm"
                >
                  <Printer size={14} strokeWidth={3} />
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative max-h-[95vh] flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-[#F97316]" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Nova Ordem de Locação</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 p-1">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRental} className="space-y-6 overflow-hidden flex flex-col flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Cliente</label>
                  <select 
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-medium bg-white"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  >
                    <option value="">Selecione...</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Retirada</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Previsão Retorno</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-2 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono font-black"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 shrink-0">Itens do Pedido</label>
                <div className="bg-slate-50 border border-slate-100 rounded-xl flex-1 overflow-auto p-4 content-start">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {inventory.map(item => {
                      const selected = selectedItems.find(si => si.inventory_id === item.id);
                      return (
                        <div key={item.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-[11px] text-slate-700 truncate uppercase tracking-tight">{item.name}</p>
                            <p className="text-[9px] text-slate-400 font-mono">Disp: {item.available}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 h-8">
                            <button 
                              type="button" 
                              onClick={() => removeItem(item.id)} 
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 border border-slate-100 rounded bg-slate-50"
                            >
                              <MinusCircle size={14} />
                            </button>
                            <span className={cn(
                              "font-mono font-black text-sm w-5 text-center",
                              (selected?.quantity || 0) > 0 ? "text-slate-800" : "text-slate-300"
                            )}>{selected?.quantity || 0}</span>
                            <button 
                              type="button" 
                              disabled={item.available <= (selected?.quantity || 0)}
                              onClick={() => addItem(item.id)} 
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-emerald-500 border border-slate-100 rounded bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <PlusCircle size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 text-[11px] text-slate-500 font-black uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={selectedItems.length === 0}
                  className="flex-1 px-4 py-3 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                >
                  Gerar Contrato (OS)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
